import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';
import { AttachmentFile } from '../types';

interface DocumentViewerModalProps {
  attachment: AttachmentFile | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ attachment, onClose }) => {
  if (!attachment) return null;

  const isImage = attachment.type.startsWith('image/') || attachment.name.endsWith('.png') || attachment.name.endsWith('.jpg') || attachment.name.endsWith('.jpeg');
  const isLog = attachment.type.startsWith('text/') || attachment.name.endsWith('.txt') || attachment.name.endsWith('.log') || attachment.name.endsWith('.json');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base truncate max-w-md">
                {attachment.name}
              </h3>
              <p className="text-xs text-slate-400">
                {(attachment.size / 1024).toFixed(1)} KB • Uploaded {attachment.uploadedAt}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={attachment.url}
              download={attachment.name}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Download / Open file"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 flex items-center justify-center min-h-[300px]">
          {isImage ? (
            <div className="relative group max-w-full">
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-h-[60vh] max-w-full rounded-lg object-contain border border-slate-800 shadow"
                referrerPolicy="no-referrer"
              />
              <div className="mt-2 text-center text-xs text-slate-400">
                Attachment screenshot captured during test cycle execution
              </div>
            </div>
          ) : isLog ? (
            <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {`[2026-09-20 14:02:18.421] [FATAL] [WebAuthenticationSessionDelegate]:
Thread 1: Fatal Exception: NullPointerException: Attempt to invoke virtual method 'boolean java.lang.String.equals(java.lang.Object)' on a null object reference
    at io.finflow.auth.SecurePaymentSession.onOtpTimeoutReceived(SecurePaymentSession.kt:142)
    at io.finflow.auth.WebviewDelegate.handleTimeout(WebviewDelegate.kt:89)
    at io.finflow.ui.checkout.PaymentFragment.onSessionExpired(PaymentFragment.kt:312)
    at android.os.Handler.handleCallback(Handler.java:958)
    at android.os.Looper.loopOnce(Looper.java:205)
    at android.os.Looper.loop(Looper.java:294)
    at android.app.ActivityThread.main(ActivityThread.java:8177)
    at java.lang.reflect.Method.invoke(Native Method)
    at com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:552)
    at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:971)`}
            </div>
          ) : (
            <div className="text-center p-8">
              <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium">{attachment.name}</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Document / Diagnostic Archive ({(attachment.size / 1024).toFixed(1)} KB)</p>
              <a
                href={attachment.url}
                download={attachment.name}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
              >
                <span>Download Document</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
          <span>Encrypted QA Asset Storage • Verified Integrity</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
