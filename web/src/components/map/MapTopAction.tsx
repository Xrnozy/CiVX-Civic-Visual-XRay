import { Link } from 'react-router-dom';
import { ButtonPrimary } from '../ui/Buttons';

interface Props {
  actionTo?: string;
  actionLabel?: string;
}

export function MapTopAction({
  actionTo = '/report',
  actionLabel = 'Report Issue',
}: Props) {
  return (
    <Link to={actionTo} className="map-top-action">
      <ButtonPrimary>{actionLabel}</ButtonPrimary>
    </Link>
  );
}
