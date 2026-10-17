"""Submit a consented Connectfy application to the Applause Google screener."""

import asyncio
import json
import re
import sys
from datetime import date
from typing import Any

FORM_URL = (
    "https://docs.google.com/forms/d/e/"
    "1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform"
)
ANSWER_YES = "Yes"
AMBASSADOR_FULL_NAME = "Ezra Bosley"
AMBASSADOR_EMAIL = "ezrahbosire1@gmail.com"
AMBASSADOR_UTEST_ID = "1850796"
MAX_PAGES = 15
DELAY_MS = 350

FIELD_ALIASES = {
    "acceptance": ("do you understand and accept",),
    "full_name": ("full legal name",),
    "utest_email": ("what email address do you use for your utest account",),
    "phone": ("phone number we can use to contact you",),
    "gmail_email": ("Gmail",),
    "utest_id": ("what is your utest id",),
    "ambassador_full_name": ("uTest Ambassador Full Name",),
    "ambassador_email": ("uTest Ambassador Email ID",),
    "ambassador_utest_id": ("uTest Ambassador Tester ID",),
    "country": ("country",),
    "age": ("what is your age",),
    "date_of_birth": ("date of birth",),
    "gender": ("what is your gender",),
    "languages": ("what languages are you fluent in",),
    "has_valid_id": ("do you have a valid, government-issued ID",),
    "recording_space_available": ("do you have access to both a quiet space",),
    "device_type": ("what type of mobile device do you own",),
    "os_version": ("what is the os version",),
}

LANGUAGE_OPTIONS = {
    "English",
    "Bengali",
    "Hindi",
    "Bahasa",
    "Portuguese",
    "Spanish (MX)",
    "None of the above",
    "Other",
}
GENDER_OPTIONS = {"Male", "Female", "Non-Binary", "Prefer not to say", "Other"}
DEVICE_OPTIONS = {
    "Android (mobile) — camera & mic functional",
    "iOS (mobile) — camera & mic functional",
    "No functional camera/microphone",
    "Other",
}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def calculate_age_range(date_of_birth: str, today: date | None = None) -> str:
    born = date.fromisoformat(date_of_birth)
    current = today or date.today()
    age = current.year - born.year - ((current.month, current.day) < (born.month, born.day))
    if age < 18:
        raise ValueError("The screener is only available to applicants aged 18 or older.")
    if age <= 25:
        return "18-25"
    if age <= 39:
        return "26-39"
    if age <= 59:
        return "40-59"
    return "60+"


def validate_submission(data: dict[str, Any]) -> None:
    required = (
        "full_name",
        "utest_email",
        "phone",
        "gmail_email",
        "utest_id",
        "country",
        "date_of_birth",
        "gender",
        "languages",
        "has_valid_id",
        "recording_space_available",
        "device_type",
        "os_version",
        "screener_consent",
    )
    missing = [key for key in required if key not in data or data[key] in (None, "", [])]
    if missing:
        raise ValueError(f"Missing required screener data: {', '.join(missing)}")
    for key, maximum in (
        ("full_name", 200),
        ("utest_email", 254),
        ("phone", 100),
        ("gmail_email", 254),
        ("utest_id", 120),
        ("country", 100),
        ("os_version", 120),
    ):
        value = str(data[key]).strip()
        if not value or len(value) > maximum:
            raise ValueError(f"Enter a valid {key.replace('_', ' ')}.")
    if not EMAIL_PATTERN.fullmatch(str(data["utest_email"]).strip()):
        raise ValueError("Enter a valid uTest email address.")
    gmail_email = str(data["gmail_email"]).strip()
    if not EMAIL_PATTERN.fullmatch(gmail_email) or not gmail_email.casefold().endswith("@gmail.com"):
        raise ValueError("Use the applicant's profile email, which must be a @gmail.com address.")
    if not re.fullmatch(r"30\d+", str(data["utest_id"]).strip()):
        raise ValueError("The Applause screener is available only for uTest IDs that start with 30.")
    if data["screener_consent"] is not True:
        raise ValueError("The applicant has not consented to the external screener.")
    if data["gender"] not in GENDER_OPTIONS:
        raise ValueError("Choose a valid gender option.")
    if data["device_type"] not in DEVICE_OPTIONS:
        raise ValueError("Choose a valid mobile-device option.")
    languages = data["languages"]
    if not isinstance(languages, list) or not languages or any(
        language not in LANGUAGE_OPTIONS for language in languages
    ):
        raise ValueError("Choose at least one valid fluent-language option.")
    if data["gender"] == "Other" and not str(data.get("gender_other", "")).strip():
        raise ValueError("Enter the selected gender.")
    if "Other" in languages and not str(data.get("language_other", "")).strip():
        raise ValueError("Enter the selected language.")
    if data["device_type"] == "Other" and not str(data.get("device_other", "")).strip():
        raise ValueError("Enter the selected mobile-device type.")
    if not isinstance(data["has_valid_id"], bool) or not isinstance(
        data["recording_space_available"], bool
    ):
        raise ValueError("Confirm the ID and recording-space questions.")
    calculate_age_range(str(data["date_of_birth"]))


def _question_key(title: str) -> str | None:
    normalized = title.casefold()
    for key, aliases in FIELD_ALIASES.items():
        if any(alias.casefold() in normalized for alias in aliases):
            return key
    return None


async def _select_radio(item: Any, value: str, other_text: str = "") -> None:
    option = item.get_by_role("radio", name=value, exact=True)
    if value == "Other":
        option = item.get_by_role("radio", name="Other", exact=False)
    if await option.count() == 0:
        raise RuntimeError("A required screener choice is no longer available.")
    await option.first.click()
    if value == "Other" and other_text:
        other_input = item.get_by_role("textbox", name="Other response")
        if await other_input.count():
            await other_input.fill(other_text)


async def fill_current_page(page: Any, data: dict[str, Any]) -> None:
    items = page.locator('div[role="listitem"]')
    for index in range(await items.count()):
        item = items.nth(index)
        heading = item.locator('[role="heading"]').first
        if not await heading.count() or await heading.get_attribute("aria-level") == "2":
            continue

        title = (await heading.inner_text()).replace("*", "").strip()
        key = _question_key(title)
        if key is None:
            if "*" in await item.inner_text():
                raise RuntimeError("The screener has a required question this integration does not recognize.")
            continue

        value: Any = data.get(key)
        if key == "acceptance":
            value = ANSWER_YES
        elif key == "ambassador_full_name":
            value = AMBASSADOR_FULL_NAME
        elif key == "ambassador_email":
            value = AMBASSADOR_EMAIL
        elif key == "ambassador_utest_id":
            value = AMBASSADOR_UTEST_ID
        elif key == "age":
            value = calculate_age_range(str(data["date_of_birth"]))
        elif key == "has_valid_id" or key == "recording_space_available":
            value = ANSWER_YES if data[key] else "No"
        elif key == "languages":
            for language in data["languages"]:
                checkbox = item.get_by_role("checkbox", name=language, exact=True)
                if await checkbox.count() == 0:
                    raise RuntimeError("A selected fluent-language option is no longer available.")
                await checkbox.first.click()
            if "Other" in data["languages"]:
                other_input = item.get_by_role("textbox", name="Other response")
                if await other_input.count():
                    await other_input.fill(str(data.get("language_other", "")).strip())
            continue
        elif key == "gender":
            await _select_radio(item, str(value), str(data.get("gender_other", "")))
            continue
        elif key == "device_type":
            device_option = str(value)
            if device_option == "Other":
                await _select_radio(item, "Other", str(data.get("device_other", "")))
            else:
                await _select_radio(item, device_option)
            continue

        if await item.get_by_role("radio").count():
            await _select_radio(item, str(value))
        elif await item.locator('input[type="date"]').count():
            await item.locator('input[type="date"]').first.fill(str(data["date_of_birth"]))
        elif await item.get_by_role("listbox").count():
            await item.get_by_role("listbox").first.click()
            option = page.get_by_role("option", name=str(value), exact=True).last
            if not await option.count():
                raise RuntimeError("The applicant's country is not available in the screener.")
            await option.click()
        else:
            text_input = item.locator(
                'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea'
            ).first
            if not await text_input.count():
                raise RuntimeError("A required screener question has an unsupported answer field.")
            await text_input.fill(str(value))
        await page.wait_for_timeout(DELAY_MS)


async def submit_one(data: dict[str, Any]) -> dict[str, Any]:
    try:
        from playwright.async_api import async_playwright
    except ImportError as error:
        raise RuntimeError("Playwright is not installed in the backend Python environment.") from error

    submit_clicked = False
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            await page.goto(FORM_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_selector('div[role="listitem"]', timeout=15000)

            for _ in range(MAX_PAGES):
                await fill_current_page(page, data)
                submit_button = page.get_by_role("button", name="Submit", exact=True)
                if await submit_button.count():
                    await submit_button.first.click()
                    submit_clicked = True
                    try:
                        await page.get_by_text(
                            "Your response has been recorded", exact=False
                        ).wait_for(timeout=20000)
                    except Exception:
                        return {
                            "ok": False,
                            "submitted": None,
                            "error": "The form submission could not be confirmed.",
                        }
                    return {"ok": True, "submitted": True}

                next_button = page.get_by_role("button", name="Next", exact=True)
                if not await next_button.count():
                    raise RuntimeError("The screener did not provide a Next or Submit button.")
                previous_questions = await page.locator(
                    'div[role="listitem"] [role="heading"]'
                ).all_inner_texts()
                await next_button.first.click()
                await page.wait_for_timeout(700)
                current_questions = await page.locator(
                    'div[role="listitem"] [role="heading"]'
                ).all_inner_texts()
                if current_questions == previous_questions:
                    errors = await page.locator('[role="alert"]').all_inner_texts()
                    raise RuntimeError(
                        "The screener rejected one or more answers."
                        if errors
                        else "The screener did not advance to the next page."
                    )
            raise RuntimeError("The screener exceeded the configured page limit.")
        except Exception as error:
            return {
                "ok": False,
                "submitted": None if submit_clicked else False,
                "error": str(error) or "The screener submission failed.",
            }
        finally:
            try:
                await context.close()
                await browser.close()
            except Exception as error:
                print(f"Unable to close screener browser cleanly: {error}", file=sys.stderr)


async def main() -> int:
    try:
        submission = json.load(sys.stdin)
        if not isinstance(submission, dict):
            raise ValueError("Expected a JSON object on standard input.")
        validate_submission(submission)
        result = await submit_one(submission)
        print(json.dumps(result))
        return 0 if result["ok"] else 1
    except Exception as error:
        print(json.dumps({"ok": False, "submitted": False, "error": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
