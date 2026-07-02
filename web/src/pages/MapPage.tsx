import { GlobalNav } from '../components/ui/GlobalNav';
import { CommunityMapShell } from '../components/map/CommunityMapShell';

export default function MapPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <GlobalNav />
      <CommunityMapShell />
    </div>
  );
}
