export default function FooterBar({ connected }: { connected: boolean }) {
  return (
    <footer className="footer-bar">
      <span><i className={connected ? "online" : ""} /> BACKEND {connected ? "ONLINE" : "OFFLINE"}</span>
      <span>WS://LOCALHOST:8765</span>
      <span>BUILD GS-2.4.1</span>
      <span className="footer-clock">{new Date().toLocaleDateString("en-CA")} / {new Date().toISOString().slice(11, 19)} UTC</span>
    </footer>
  );
}
