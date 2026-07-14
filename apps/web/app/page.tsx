import { SubscribeForm } from "@/components/subscribe-form";
import { countOpenBays, getBays, getRecentEvents } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bays, events] = await Promise.all([getBays(), getRecentEvents()]);
  const openCount = countOpenBays(bays);
  const occupiedCount = bays.filter((bay) => bay.status === "occupied").length;
  const unknownCount = bays.filter((bay) => bay.status === "unknown").length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>EV Bay</h1>
          <p>Live charging bay availability from the on-prem camera monitor.</p>
        </div>
        <form action="/api/refresh" method="post">
          <button className="button secondary" type="submit">Refresh</button>
        </form>
      </header>

      <div className="content">
        <section>
          <div className="metrics">
            <div className="metric">
              <span className="muted">Open</span>
              <strong>{openCount}</strong>
            </div>
            <div className="metric">
              <span className="muted">Occupied</span>
              <strong>{occupiedCount}</strong>
            </div>
            <div className="metric">
              <span className="muted">Unknown</span>
              <strong>{unknownCount}</strong>
            </div>
          </div>

          <div className="bay-grid">
            {bays.map((bay) => (
              <article className={`bay ${bay.status}`} key={bay.id}>
                <div className="bay-header">
                  <h2>{bay.label}</h2>
                  <span className={`status ${bay.status}`}>{bay.status}</span>
                </div>
                <p className="muted">Confidence: {Math.round(bay.confidence * 100)}%</p>
                <p className="muted">Source: {bay.source}</p>
                <p className="muted">Updated: {new Date(bay.updated_at).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel">
          <h2>Get notified</h2>
          <p className="muted">Subscribe for alerts when one or more charging bays become available.</p>
          <SubscribeForm />
        </aside>

        <section className="panel">
          <h2>Recent bay events</h2>
          <table className="events">
            <thead>
              <tr>
                <th>Bay</th>
                <th>Status</th>
                <th>Source</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.bay_id}</td>
                  <td>{event.status}</td>
                  <td>{event.source}</td>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

