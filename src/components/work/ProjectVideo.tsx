'use client';

/** The Agent Bridge launch video: self-hosted, muted, loaded only when asked for. */
export default function ProjectVideo() {
  return (
    <div className="video">
      <video muted playsInline loop controls preload="none" poster="/media/agent-bridge-poster.jpg" aria-label="Agent Bridge launch video, no sound" width={1920} height={1080}>
        <source src="/media/agent-bridge-demo.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
