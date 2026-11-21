import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900">DineDesk documentation</h1>
      <p className="mt-3 text-slate-600">Quick start for the restaurant management SaaS.</p>
      <div className="mt-8 space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Setup</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Copy <code>.env.example</code> to <code>.env</code> and set secrets.</li>
            <li>Run <code>npm install</code>, <code>npm run db:push</code>, and <code>npm run db:seed</code>.</li>
            <li>Start with <code>npm run dev</code> and open <code>http://localhost:3000</code>.</li>
          </ol>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Demo access</h2>
          <p className="mt-2 text-sm text-slate-600">Request a 12-hour demo from the home page. Super admin approves the request and emails a one-time code.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Flows</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Guests scan a table QR (<code>/q/&lt;token&gt;</code>) to browse menu, add to cart, place orders, and request/view bill.</li>
            <li>Staff use dashboard pages for orders, kitchen, tables/QR, menu, billing, analytics, and settings.</li>
          </ul>
        </section>
      </div>
      <div className="mt-10"><Link href="/" className="text-orange-600 font-semibold hover:underline">? Back home</Link></div>
    </div>
  );
}
