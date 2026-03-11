"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const kpis = [
  { title: "Generated PDFs", value: "128", delta: "+12%" },
  { title: "Active Users", value: "54",  delta: "+8%" },
  { title: "Templates",    value: "6",   delta: "±0%" },
  { title: "Storage Used", value: "182 MB", delta: "+3%" },
];

const chartData = [
  { day: "Mon", val: 12 }, { day: "Tue", val: 18 }, { day: "Wed", val: 14 },
  { day: "Thu", val: 22 }, { day: "Fri", val: 28 }, { day: "Sat", val: 19 }, { day: "Sun", val: 24 },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">Preview</span>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.title} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">{k.title}</div>
            <div className="mt-1 text-3xl font-bold">{k.value}</div>
            <div className="text-xs text-emerald-600 mt-1">{k.delta}</div>
          </div>
        ))}
      </section>

      {/* Chart + Table */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 font-medium">Weekly Activity</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="val" stroke="#000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 font-medium">Recent Activity</div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr><th className="py-2">User</th><th>Action</th><th className="text-right">Status</th></tr>
            </thead>
            <tbody>
              {[
                { name: "Pascal Rossi", item: "PDF Export", status: "Success" },
                { name: "Nadine Weninger", item: "New Template", status: "Queued" },
                { name: "Franziska Winder", item: "PDF Export", status: "Failed" },
                { name: "Bianca Hasler", item: "Project Update", status: "Success" },
              ].map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td>{r.item}</td>
                  <td className="text-right">
                    <span className={
                      r.status === "Success" ? "text-emerald-600" :
                      r.status === "Failed"  ? "text-red-600" : "text-amber-600"
                    }>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
