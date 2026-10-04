import Icon from './Icon';

export default function CameraView({ url, label, secondary = false }: { url?: string; label: string; secondary?: boolean }) {
  return (
    <div className={`camera-view ${secondary ? "secondary" : ""}`}>
      {url ? (
        <img src={url} alt={`${label} live stream`} />
      ) : (
        <div className="camera-fallback">
          <div className="reticle"><span /><span /><span /><span /></div>
          <div className="terrain-line" />
          <Icon name="camera" className="h-6 w-6" />
          <strong>AWAITING VIDEO</strong>
          <small>STREAM CHANNEL READY</small>
        </div>
      )}
      <div className="feed-label"><span className="live-dot" />{label}</div>
      <div className="feed-time">{new Date().toISOString().slice(11, 19)} UTC</div>
    </div>
  );
}
