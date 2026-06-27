import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const SEVERITY_COLORS = { Low: '#0D9E6E', Medium: '#F59E0B', High: '#F97316', Critical: '#EF4444' };
const STATUS_COLORS = {
  Reported: '#6B7280', Verified: '#3B82F6', Escalated: '#F97316',
  'In Progress': '#8B5CF6', Resolved: '#0D9E6E',
};

function timeAgo(ts) {
  if (!ts) return "—";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
function StatSkeleton() {
  return (
    <div className="rounded-2xl p-3.5 sm:p-5 border border-[#e8ecf8] bg-white">
      <div className="skeleton h-6 sm:h-8 w-12 sm:w-16 rounded-lg mb-2" />
      <div className="skeleton h-3.5 sm:h-4 w-20 sm:w-24 rounded" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white border border-[#e2e8f8] rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="skeleton h-5 w-36 rounded mb-4" />
      <div className="skeleton rounded-xl" style={{ height: 260 }} />
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, icon, bg, border, color, trend, delay }) {
  return (
    <div
      className={`rounded-2xl p-3.5 sm:p-5 flex flex-col gap-1.5 sm:gap-2 border card-hover shadow-sm fade-up delay-${delay}`}
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: color + "18" }}
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[22px]" style={{ color, fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        {trend !== undefined && (
          <span className="text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full" style={{ color: color, background: color + "14" }}>
            {trend > 0 ? `+${trend}` : trend} new
          </span>
        )}
      </div>
      <p className="text-[18px] min-[360px]:text-[22px] sm:text-[30px] font-black leading-none truncate" style={{ color, fontFamily: "var(--font-display)" }} title={value}>
        {value}
      </p>
      <p className="text-[11px] sm:text-[12.5px] font-semibold truncate" style={{ color: color + "cc" }} title={label}>{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'issues'), orderBy('createdAt', 'desc')));
        setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('[Dashboard] Firestore error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, []);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto w-full space-y-6 pb-24">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-[#f0f3ff] flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-[#c3c5d7]" style={{ fontSize: "40px" }}>bar_chart</span>
        </div>
        <h2 className="text-[22px] font-bold text-[#151c27] mb-2" style={{ fontFamily: "var(--font-display)" }}>
          No data yet
        </h2>
        <p className="text-[#737686] text-[14px] mb-6 max-w-xs">
          Be the first to report a civic issue and the dashboard will light up with real data.
        </p>
        <button
          onClick={() => navigate('/report')}
          className="bg-[#1a56db] text-white px-6 py-2.5 rounded-xl font-bold text-[14px] hover:bg-[#003fb1] transition-all hover:-translate-y-0.5"
        >
          Report First Issue
        </button>
      </div>
    );
  }

  // ── Compute stats ──────────────────────────────────────────────────────────
  const totalIssues    = issues.length;
  const resolved       = issues.filter(i => i.status === 'Resolved').length;
  const critical       = issues.filter(i => i.severity === 'Critical').length;
  const escalated      = issues.filter(i => i.status === 'Escalated').length;
  const resolutionRate = totalIssues > 0 ? ((resolved / totalIssues) * 100).toFixed(0) : 0;

  // By Category
  const categoryMap = {};
  issues.forEach(i => { categoryMap[i.issueType] = (categoryMap[i.issueType] || 0) + 1; });
  const byCategory = Object.keys(categoryMap)
    .map(k => ({ name: k, count: categoryMap[k] }))
    .sort((a, b) => b.count - a.count);

  // By Severity
  const severityMap = {};
  issues.forEach(i => { severityMap[i.severity] = (severityMap[i.severity] || 0) + 1; });
  const bySeverity = Object.keys(severityMap).map(k => ({ name: k, value: severityMap[k] }));

  // By Status
  const statusMap = {};
  issues.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1; });
  const byStatus = Object.keys(statusMap).map(k => ({ name: k, value: statusMap[k] }));

  // By Day (last 7 days)
  const byDayMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDayMap[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
  }
  issues.forEach(i => {
    try {
      const d = i.createdAt?.toDate ? i.createdAt.toDate() : new Date(i.createdAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (byDayMap[key] !== undefined) byDayMap[key]++;
    } catch (_) {}
  });
  const byDay = Object.keys(byDayMap).map(k => ({ date: k, count: byDayMap[k] }));

  // Department breakdown
  const deptAvgDays = { PWD: 14, 'Municipal Corporation': 10, 'Electricity Board': 7, 'Water Board': 5, 'Sanitation Department': 3 };
  const deptMap = {};
  issues.forEach(i => {
    const d = i.department || 'Unknown';
    if (!deptMap[d]) deptMap[d] = { total: 0, resolved: 0, pending: 0, avg: deptAvgDays[d] || 7 };
    deptMap[d].total++;
    if (i.status === 'Resolved') deptMap[d].resolved++;
    else deptMap[d].pending++;
  });
  const depts = Object.keys(deptMap).map(k => ({ name: k, ...deptMap[k] })).sort((a, b) => b.total - a.total);

  const recent = issues.slice(0, 5);

  const tooltipStyle = {
    borderRadius: '10px',
    border: 'none',
    boxShadow: '0 4px 20px rgba(26,86,219,0.12)',
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
  };

  return (
    <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto w-full space-y-6 pb-24">
      {/* Header */}
      <div className="fade-up">
        <h1 className="text-[26px] font-extrabold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
          Impact Dashboard
        </h1>
        <p className="text-[#737686] font-medium text-[14px] mt-0.5">
          Real-time civic data · Last updated {new Date().toLocaleTimeString()}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={totalIssues} label="Total Reported" icon="flag" bg="#f0f3ff" border="#dbe1ff" color="#003fb1" delay={100} />
        <StatCard value={`${resolved} (${resolutionRate}%)`} label="Resolved" icon="check_circle" bg="#ecfdf5" border="#d1fae5" color="#059669" delay={200} />
        <StatCard value={critical} label="Critical Issues" icon="emergency" bg="#fef2f2" border="#fee2e2" color="#dc2626" delay={300} />
        <StatCard value={escalated} label="Escalated" icon="trending_up" bg="#fff7ed" border="#ffedd5" color="#ea580c" delay={400} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 fade-up delay-200">
        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-4 sm:p-5 shadow-sm overflow-hidden">
          <h2 className="text-[15px] font-bold text-[#151c27] mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Issues by Category
          </h2>
          <div className="w-full">
            <div style={{ height: 260 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} margin={{ top: 10, right: 10, bottom: 48, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f3ff" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'Inter' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f4f6ff' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#1A56DB" radius={[5, 5, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-4 sm:p-5 shadow-sm overflow-hidden">
          <h2 className="text-[15px] font-bold text-[#151c27] mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Severity Distribution
          </h2>
          <div className="w-full">
            <div style={{ height: 260 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={32} labelLine={false} label={renderCustomLabel}>
                    {bySeverity.map((entry, i) => (
                      <Cell key={i} fill={SEVERITY_COLORS[entry.name] || '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 fade-up delay-300">
        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-4 sm:p-5 shadow-sm overflow-hidden">
          <h2 className="text-[15px] font-bold text-[#151c27] mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Reports Over Last 7 Days
          </h2>
          <div className="w-full">
            <div style={{ height: 260 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byDay} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f3ff" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: 'Inter' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'Inter' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke="#1A56DB" strokeWidth={2.5} dot={{ r: 4, fill: '#fff', stroke: '#1A56DB', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#1A56DB' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f8] rounded-2xl p-4 sm:p-5 shadow-sm overflow-hidden">
          <h2 className="text-[15px] font-bold text-[#151c27] mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Resolution Status
          </h2>
          <div className="w-full">
            <div style={{ height: 260 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus} layout="vertical" margin={{ top: 10, right: 16, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f3ff" />
                  <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'Inter' }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontFamily: 'Inter' }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip cursor={{ fill: '#f4f6ff' }} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={32}>
                    {byStatus.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || '#9CA3AF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Department table */}
      <div className="bg-white border border-[#e2e8f8] rounded-2xl shadow-sm overflow-hidden fade-up delay-400">
        <div className="p-5 border-b border-[#e2e8f8] flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
            Department Breakdown
          </h2>
          <span className="text-[12px] text-[#737686]">{depts.length} departments</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left" role="table">
            <thead>
              <tr className="bg-[#f9f9ff] text-[#737686] text-[11.5px] font-bold border-b border-[#e2e8f8] uppercase tracking-wide">
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Resolved</th>
                <th className="px-5 py-3 text-right">Pending</th>
                <th className="px-5 py-3 text-right">Avg Days</th>
                <th className="px-5 py-3">Progress</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d, i) => {
                const pct = d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0;
                return (
                  <tr key={i} className="border-b border-[#f0f3ff] last:border-0 hover:bg-[#f9f9ff] transition-colors">
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-[#151c27]">{d.name}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-bold text-[#151c27]">{d.total}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-semibold text-[#059669]">{d.resolved}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-semibold text-[#ea580c]">{d.pending}</td>
                    <td className="px-5 py-3.5 text-[13px] text-right font-medium text-[#737686]">{d.avg}d</td>
                    <td className="px-5 py-3.5 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#e8ecf8] rounded-full overflow-hidden">
                          <div className="h-full bg-[#059669] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-[#737686] w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-[#e2e8f8] rounded-2xl p-5 shadow-sm fade-up delay-500">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#151c27]" style={{ fontFamily: "var(--font-display)" }}>
            Recent Activity
          </h2>
          <button
            onClick={() => navigate('/map')}
            className="text-[12px] font-semibold text-[#1a56db] hover:underline"
          >
            View all on map →
          </button>
        </div>
        <div className="space-y-1">
          {recent.map(i => (
            <div
              key={i.id}
              onClick={() => navigate(`/issue/${i.id}`)}
              className="flex gap-3 items-center p-3 hover:bg-[#f9f9ff] rounded-xl transition-colors cursor-pointer group"
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: SEVERITY_COLORS[i.severity] || '#9CA3AF' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-[13.5px] font-semibold text-[#151c27] truncate">{i.issueType}</p>
                  <span className="text-[11px] text-[#737686] flex-shrink-0 ml-2">{timeAgo(i.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: SEVERITY_COLORS[i.severity] || '#9CA3AF', backgroundColor: (SEVERITY_COLORS[i.severity] || '#9CA3AF') + '18' }}>
                    {i.severity}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: STATUS_COLORS[i.status] || '#9CA3AF', backgroundColor: (STATUS_COLORS[i.status] || '#9CA3AF') + '18' }}>
                    {i.status}
                  </span>
                  {i.department && (
                    <span className="text-[10px] text-[#737686] px-2 py-0.5 rounded-md bg-[#f0f3ff]">{i.department}</span>
                  )}
                </div>
              </div>
              <span className="material-symbols-outlined text-[#c3c5d7] group-hover:text-[#1a56db] transition-colors" style={{ fontSize: "16px" }}>
                chevron_right
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
