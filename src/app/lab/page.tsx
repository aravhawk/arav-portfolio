/* Engine lab: a throwaway page for tuning the water. Removed before ship. */

export default function Lab() {
  return (
    <main data-scene="lab" style={{ minHeight: '320vh' }}>
      <section style={{ height: '165vh', padding: '88px 24px 0', boxSizing: 'border-box' }}>
        <div data-bed="lake" style={{ height: '100%', position: 'relative' }}>
          <h1
            data-ice
            style={{
              position: 'absolute',
              top: '34vh',
              left: 0,
              right: 0,
              margin: 0,
              textAlign: 'center',
              fontSize: '17.5vw',
              lineHeight: 1,
              letterSpacing: '-0.045em',
              fontWeight: 700,
              opacity: 0,
            }}
          >
            <span data-ice-line>Arav Jain</span>
          </h1>
        </div>
      </section>
      <section style={{ height: '110vh', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, padding: '120px 64px' }}>
        <div>
          <h2 style={{ fontSize: 96, margin: 0, letterSpacing: '-0.04em', lineHeight: 0.95 }}>Infiniview</h2>
          <p style={{ maxWidth: 420, fontSize: 18, lineHeight: 1.5 }}>
            Infiniview connects to your GitHub, deploys your app in a sandbox, and runs real attacks against it. You
            get replayable proof of what broke.
          </p>
        </div>
        <div data-bed="pool:a" style={{ height: '70vh' }} />
      </section>
      <section style={{ height: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, padding: '120px 64px' }}>
        <div data-bed="pool:b" style={{ height: '60vh' }} />
        <div>
          <h2 style={{ fontSize: 96, margin: 0, letterSpacing: '-0.04em', lineHeight: 0.95 }}>21</h2>
          <p style={{ maxWidth: 420, fontSize: 18, lineHeight: 1.5 }}>merged pull requests to other people&apos;s open source.</p>
        </div>
      </section>
    </main>
  );
}
