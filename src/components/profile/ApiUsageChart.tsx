import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';

interface UsageDataPoint {
  date: string;
  'tailor-application': number;
  'answer-questions': number;
  total: number;
}

export const ApiUsageChart = () => {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<UsageDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUsageData();
    }
  }, [user, timeRange]);

  const fetchUsageData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      let query = supabase
        .from('api_usage')
        .select('function_name, tokens_used, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      // Apply date filter
      if (timeRange !== 'all') {
        const daysAgo = timeRange === '7d' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by date and function
      const grouped: Record<string, UsageDataPoint> = {};
      
      data?.forEach((row) => {
        const date = new Date(row.created_at).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        if (!grouped[date]) {
          grouped[date] = {
            date,
            'tailor-application': 0,
            'answer-questions': 0,
            total: 0,
          };
        }
        
        const funcName = row.function_name as keyof UsageDataPoint;
        if (funcName === 'tailor-application' || funcName === 'answer-questions') {
          grouped[date][funcName]++;
        }
        grouped[date].total++;
      });

      setUsageData(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalCalls = usageData.reduce((sum, d) => sum + d.total, 0);
  const tailorCalls = usageData.reduce((sum, d) => sum + d['tailor-application'], 0);
  const answerCalls = usageData.reduce((sum, d) => sum + d['answer-questions'], 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            API Usage Breakdown
          </CardTitle>
          <Select value={timeRange} onValueChange={(v: '7d' | '30d' | 'all') => setTimeRange(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{totalCalls}</div>
            <div className="text-xs text-muted-foreground">Total Calls</div>
          </div>
          <div className="text-center p-3 bg-blue-500/10 rounded-lg">
            <div className="text-2xl font-bold text-blue-500">{tailorCalls}</div>
            <div className="text-xs text-muted-foreground">Resume Tailoring</div>
          </div>
          <div className="text-center p-3 bg-green-500/10 rounded-lg">
            <div className="text-2xl font-bold text-green-500">{answerCalls}</div>
            <div className="text-xs text-muted-foreground">Question Answering</div>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : usageData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No API usage data yet</p>
              <p className="text-xs">Start using AI features to see your usage here</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar 
                dataKey="tailor-application" 
                name="Resume Tailoring" 
                fill="hsl(217, 91%, 60%)" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="answer-questions" 
                name="Question Answering" 
                fill="hsl(142, 71%, 45%)" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          Using gpt-4o-mini for all AI features (cost-effective)
        </p>
      </CardContent>
    </Card>
  );
};
