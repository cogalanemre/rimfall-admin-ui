import { fetchMaps, fmtDate } from "../api";
import { usePoll } from "../usePoll";

const REFRESH_MS = 15000;

export default function Maps() {
  const { data, error } = usePoll(fetchMaps, REFRESH_MS);

  return (
    <>
      <div className="page-head">
        <h1>Haritalar</h1>
        {data && <div className="live">{data.length} harita</div>}
      </div>

      {error && <div className="error-banner">Sunucuya ulaşılamadı: {error}</div>}

      {data && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Ad</th>
                <th className="num">Bölüm</th>
                <th>Yapan</th>
                <th className="num">Oynanma</th>
                <th>Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td className="num">{m.id}</td>
                  <td className="strong">{m.name}</td>
                  <td className="num">{m.chunks}</td>
                  <td>{m.owner_email ? `${m.owner_name} (${m.owner_email})` : "Misafir"}</td>
                  <td className="num">{m.plays}</td>
                  <td>{fmtDate(m.created_at)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6}>Henüz kayıtlı harita yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
