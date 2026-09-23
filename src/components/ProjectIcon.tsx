import React from 'react';
import {
  Bot,
  Building2,
  CreditCard,
  FlaskConical,
  GraduationCap,
  MapPin,
  Mic,
  Radio,
  ShoppingBag,
  Store,
  Users,
  Zap
} from 'lucide-react';

interface ProjectIconProps {
  name?: string;
  className?: string;
}

export const ProjectIcon: React.FC<ProjectIconProps> = ({ name = 'flask', className = 'h-6 w-6' }) => {
  const iconProps = { className };
  switch (name.toLowerCase()) {
    case 'card': return <CreditCard {...iconProps} />;
    case 'voice': return <Mic {...iconProps} />;
    case 'ai': return <Bot {...iconProps} />;
    case 'store': return <Store {...iconProps} />;
    case 'location': return <MapPin {...iconProps} />;
    case 'people': return <Users {...iconProps} />;
    case 'movie': return <ShoppingBag {...iconProps} />;
    case 'network': return <Radio {...iconProps} />;
    case 'payment': return <CreditCard {...iconProps} />;
    case 'speed': return <Zap {...iconProps} />;
    case 'academy': return <GraduationCap {...iconProps} />;
    case 'company': return <Building2 {...iconProps} />;
    default: return <FlaskConical {...iconProps} />;
  }
};
