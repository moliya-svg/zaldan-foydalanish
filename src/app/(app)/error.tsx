"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <p className="font-semibold">Маълумот юкланмади.</p>
      <p className="mt-1 text-sm text-muted">{error.message}</p>
      <button className="btn btn-primary mt-4" onClick={reset}>Қайта уриниш</button>
    </div>
  );
}
