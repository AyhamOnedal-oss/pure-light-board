import { memo, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../../integrations/supabase/client';
import { useAnimatedNumber } from '../AnimatedNumber';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CreditCard, Zap } from 'lucide-react';

type UsageDatum = { name: string; value: number; color: string };

const UsagePieChart = memo(function UsagePieChart({ usageData, theme }: { usageData: UsageDatum[]; theme: string }) {
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1e2740' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '12px',
    color: theme === 'dark' ? '#ffffff' : '#1a1a2e',
    fontSize: '13px',
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={usageData}
          cx="50%" cy="50%"
          innerRadius={50} outerRadius={78}
          dataKey="value" paddingAngle={4} strokeWidth={0}
          isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out"
        >
          {usageData.map((entry, i) => <Cell key={`usage-${i}`} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} labelStyle={{ color: tooltipStyle.color }} />
      </PieChart>
    </ResponsiveContainer>
  );
});

export function PlansPage() {
  const { t, theme, tenantId, language } = useApp();
  const [chartLoaded, setChartLoaded] = useState(false);
  const [planData, setPlanData] = useState({
    name: 'Free',
    price: '0 SAR/mo',
    start: new Date().toISOString().slice(0, 10),
    end: '—',
    totalConversations: 0,
    usedConversations: 0,
  });

  useEffect(() => {
    if (!tenantId) {
      setChartLoaded(true);
      return;
    }
    let cancelled = false;
    setChartLoaded(false);
    (async () => {
      const [{ data: plan }, { data: workspace }] = await Promise.all([
        supabase.from('settings_plans').select('conversation_quota, conversation_topup, conversations_used, period_start').eq('tenant_id', tenantId).maybeSingle() as any,
        supabase.from('settings_workspace').select('plan').eq('id', tenantId).maybeSingle(),
      ]);
      if (cancelled) return;
      const start = (plan as any)?.period_start ?? new Date().toISOString().slice(0, 10);
      const endDate = new Date(start);
      endDate.setMonth(endDate.getMonth() + 1);
      const usedConversations = Number((plan as any)?.conversations_used ?? 0);
      const totalConversations = Number((plan as any)?.conversation_quota ?? 0)
        + Number((plan as any)?.conversation_topup ?? 0);
      setPlanData({
        name: workspace?.plan ? (workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)) : 'Free',
        price: workspace?.plan === 'professional' ? '299 SAR/mo' : workspace?.plan === 'growth' ? '199 SAR/mo' : workspace?.plan === 'starter' ? '99 SAR/mo' : '0 SAR/mo',
        start,
        end: endDate.toISOString().slice(0, 10),
        totalConversations,
        usedConversations,
      });
      setChartLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const currentPlan = planData;

  const remaining = Math.max(0, currentPlan.totalConversations - currentPlan.usedConversations);
  const usagePercent = currentPlan.totalConversations > 0
    ? Math.min(100, Math.round((currentPlan.usedConversations / currentPlan.totalConversations) * 100))
    : 0;

  const usageData = useMemo(() => [
    { name: t('Used', 'مستخدم'), value: currentPlan.usedConversations, color: '#043CC8' },
    { name: t('Remaining', 'متبقي'), value: remaining, color: theme === 'dark' ? '#ffffff' : '#1a1a2e' },
  ], [currentPlan.usedConversations, remaining, theme, language]);

  // Animated count-up values
  const animatedPercent = useAnimatedNumber(usagePercent, 2000, 200);
  const animatedUsed = useAnimatedNumber(currentPlan.usedConversations, 2200, 300);
  const animatedRemaining = useAnimatedNumber(remaining, 2200, 400);
  const animatedTotal = useAnimatedNumber(currentPlan.totalConversations, 2000, 200);

  const history = [
    { name: currentPlan.name, price: currentPlan.price, start: currentPlan.start, end: currentPlan.end, status: 'active' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px]" style={{ fontWeight: 700 }}>{t('Plans & Billing', 'الخطط والفواتير')}</h1>
        <p className="text-muted-foreground text-[14px] mt-1">{t('Manage your subscription and usage', 'إدارة اشتراكك واستهلاكك')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Current Plan — compact */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#043CC8]/10 flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-[#043CC8]" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">{t('Current Plan', 'الخطة الحالية')}</p>
              <p className="text-[18px] text-[#043CC8]" style={{ fontWeight: 700 }}>{currentPlan.name}</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              [t('Price', 'السعر'), currentPlan.price],
              [t('Start Date', 'تاريخ البدء'), currentPlan.start],
              [t('End Date', 'تاريخ الانتهاء'), currentPlan.end],
              [t('Total Conversations', 'إجمالي المحادثات'), null],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-[12px] text-muted-foreground">{label}</span>
                <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                  {value !== null ? value : animatedTotal.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Chart — compact, animated numbers */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#043CC8]/10 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-[#043CC8]" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">{t('Conversations Usage', 'استخدام المحادثات')}</p>
              <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{animatedPercent}% {t('used', 'مستخدم')}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <div className="relative h-[200px] w-full">
              {chartLoaded && <UsagePieChart usageData={usageData} theme={theme} />}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-[22px] text-foreground" style={{ fontWeight: 800 }}>{animatedPercent}%</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              {usageData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-[11px]" style={{ fontWeight: 500, color: theme === 'dark' ? '#ffffff' : '#1a1a2e' }}>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-8 mt-1">
            <div className="text-center">
              <p className="text-[16px] text-[#043CC8]" style={{ fontWeight: 700 }}>{animatedUsed.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">{t('Used', 'مستخدم')}</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] text-foreground" style={{ fontWeight: 700 }}>{animatedRemaining.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">{t('Remaining', 'متبقي')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>{t('Subscription History', 'سجل الاشتراكات')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[t('Plan','الخطة'), t('Price','السعر'), t('Start','البدء'), t('End','الانتهاء'), t('Status','الحالة')].map(h => (
                  <th key={h} className="text-start px-5 py-3 text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-[13px] text-foreground" style={{ fontWeight: 500 }}>{h.name}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{h.price}</td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground">{h.start}</td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground">{h.end}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${h.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'}`} style={{ fontWeight: 600 }}>
                      {h.status === 'active' ? t('Active', 'نشط') : t('Expired', 'منتهي')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}