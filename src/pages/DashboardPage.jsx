import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import {
  Users, FileText, CheckSquare, TrendingUp,
  ArrowUpRight, Clock, Plus, ArrowRight, Target,
  Calendar, ChevronRight, Briefcase, Building2, Star,
  Layers,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [partnerStats, setPartnerStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats').catch(() => ({ data: {} })),
      api.get('/partners/stats').catch(() => ({ data: {} })),
    ]).then(([crm, partners]) => {
      setStats(crm.data);
      setPartnerStats(partners.data);
    }).finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalClosed = (stats?.dealsWon || 0) + (stats?.dealsLost || 0);
  const winRate = totalClosed > 0 ? Math.round((stats?.dealsWon || 0) / totalClosed * 100) : 0;

  const statCards = [
    {
      label: 'Pipeline value',
      value: formatCurrency(stats?.totalRevenue || 0),
      sub: `${stats?.activeDeals || 0} active deals`,
      icon: TrendingUp,
      link: '/crm',
    },
    {
      label: 'Contacts',
      value: stats?.contacts || 0,
      sub: `${stats?.newContacts || 0} new this month`,
      icon: Users,
      link: '/crm',
    },
    {
      label: 'Quotes',
      value: stats?.totalQuotes || 0,
      sub: `${stats?.viewedQuotes || 0} client views`,
      icon: FileText,
      link: '/quotes',
    },
    {
      label: 'Win rate',
      value: `${winRate}%`,
      sub: `${stats?.dealsWon || 0} won / ${stats?.dealsLost || 0} lost`,
      icon: Target,
      link: '/crm',
    },
  ];

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto px-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Dashboard overview · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link
          to="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" /> New quote
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, link }) => (
          <Link
            key={label}
            to={link}
            className="group bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">{sub}</p>
          </Link>
        ))}
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Chart — 2 cols */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">Pipeline distribution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Deals by stage</p>
            </div>
            <Link to="/crm" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              View details <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {stats?.pipelineStats?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[...stats.pipelineStats].sort((a, b) => {
                  const order = ['New Inquiry', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
                  return order.indexOf(a._id) - order.indexOf(b._id);
                })}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                barSize={48}
              >
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 11, fill: 'hsl(220 10% 52%)' }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(220 10% 52%)' }}
                  axisLine={false}
                  tickLine={false}
                  dx={-8}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(220 16% 96%)' }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid hsl(220 16% 90%)',
                    padding: '8px 12px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                  formatter={(value) => [`${value} deals`, 'Count']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.pipelineStats.map((entry, index) => {
                    // Graduated neutrals for non-terminal stages; primary for Won; destructive for Lost
                    const name = entry._id;
                    let fill = 'hsl(222 25% 12%)'; // default near-black
                    if (name === 'Won') fill = 'hsl(243 75% 59%)';
                    else if (name === 'Lost') fill = 'hsl(0 78% 57%)';
                    else {
                      // Gradient of neutrals for the others
                      const neutrals = ['hsl(222 25% 12%)', 'hsl(222 22% 26%)', 'hsl(222 18% 40%)', 'hsl(220 12% 54%)'];
                      fill = neutrals[index % neutrals.length];
                    }
                    return <Cell key={index} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">No pipeline data available</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">Recent activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Latest deals and updates</p>
            </div>
            <Link to="/crm" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all
            </Link>
          </div>
          {stats?.recentDeals?.length > 0 ? (
            <div className="space-y-4">
              {stats.recentDeals.slice(0, 4).map((deal) => (
                <Link
                  key={deal._id}
                  to={`/crm/deals/${deal._id}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                    {deal.contact ? `${deal.contact.firstName?.[0] || ''}${deal.contact.lastName?.[0] || ''}` : '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {deal.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : 'No contact'} · {deal.stage}
                    </p>
                  </div>
                  {deal.value > 0 && (
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {formatCurrency(deal.value)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Briefcase className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No recent deals</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Performance + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {stats?.monthlyDeals?.length > 0 && (
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-medium text-foreground">Monthly performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Deal flow and revenue trends</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-border" />
                  <span className="text-muted-foreground">Deals</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={stats.monthlyDeals.map(m => ({
                  month: new Date(m._id + '-01').toLocaleDateString('en-US', { month: 'short' }),
                  revenue: m.value / 1000,
                  deals: m.count,
                }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(243 75% 59%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(243 75% 59%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220 10% 52%)' }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(220 10% 52%)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(220 10% 52%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid hsl(220 16% 90%)',
                    padding: '8px 12px',
                  }}
                  formatter={(value, name) => [
                    name === 'revenue' ? `$${value}k` : `${value} deals`,
                    name === 'revenue' ? 'Revenue' : 'Deals',
                  ]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(243 75% 59%)"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  name="revenue"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="deals"
                  stroke="hsl(220 12% 70%)"
                  strokeWidth={2}
                  fill="none"
                  name="deals"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tasks */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">Pending tasks</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats?.pendingTasks || 0} tasks remaining
              </p>
            </div>
            <Link to="/crm" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Manage
            </Link>
          </div>
          {stats?.upcomingTasks?.length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingTasks.slice(0, 5).map((task) => (
                <div key={task._id} className="flex items-start gap-3 group">
                  <div className="mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                      task.priority === 'urgent' ? 'bg-destructive' :
                      task.priority === 'high' ? 'bg-foreground' :
                      'bg-border'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">All caught up</p>
            </div>
          )}
        </div>
      </div>

      {/* Team Performance */}
      {stats?.teamPerformance?.filter(m => m.dealsCreated > 0 || m.activeDeals > 0 || m.dealsWon > 0 || m.quotesCreated > 0).length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">Team performance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Individual metrics and conversion rates</p>
              </div>
              <Link to="/settings" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                Manage team <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3.5 px-6 text-xs font-medium text-muted-foreground">Team member</th>
                  <th className="text-right py-3.5 px-4 text-xs font-medium text-muted-foreground">Active</th>
                  <th className="text-right py-3.5 px-4 text-xs font-medium text-muted-foreground">Won</th>
                  <th className="text-right py-3.5 px-4 text-xs font-medium text-muted-foreground">Lost</th>
                  <th className="text-right py-3.5 px-4 text-xs font-medium text-muted-foreground">Conv.</th>
                  <th className="text-right py-3.5 px-4 text-xs font-medium text-muted-foreground">Quotes</th>
                  <th className="text-right py-3.5 px-6 text-xs font-medium text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.teamPerformance
                  .filter(m => m.dealsCreated > 0 || m.activeDeals > 0 || m.dealsWon > 0 || m.quotesCreated > 0)
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((member) => (
                    <tr key={member._id} className="border-b border-border/60 hover:bg-muted/40 transition-colors last:border-0">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium">
                            {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">{member.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3.5 px-4 text-muted-foreground tabular-nums">{member.activeDeals}</td>
                      <td className="text-right py-3.5 px-4 text-foreground font-medium tabular-nums">{member.dealsWon}</td>
                      <td className="text-right py-3.5 px-4 text-muted-foreground tabular-nums">{member.dealsLost}</td>
                      <td className="text-right py-3.5 px-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          member.conversionRate >= 50
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {member.conversionRate}%
                        </span>
                      </td>
                      <td className="text-right py-3.5 px-4 text-muted-foreground tabular-nums">{member.quotesCreated}</td>
                      <td className="text-right py-3.5 px-6 text-foreground font-medium tabular-nums">
                        {member.revenue > 0 ? formatCurrency(member.revenue) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partner Database */}
      {partnerStats && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">Partner database</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Your supplier network</p>
            </div>
            <Link to="/partners" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              Manage partners <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Hotels', value: partnerStats.hotels || 0, icon: Building2 },
              { label: 'Transport', value: partnerStats.transport || 0, icon: Briefcase },
              { label: 'Activities', value: partnerStats.activities || 0, icon: Star },
              { label: 'Destinations', value: partnerStats.destinations || 0, icon: Layers },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-4 rounded-lg bg-muted/40">
                <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground tabular-nums leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}