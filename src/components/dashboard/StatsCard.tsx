import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  valueClassName?: string;
}

export const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({ title, value, subtitle, icon, trend, className, valueClassName }, ref) => {
    return (
      <Card ref={ref} className={cn('hover:shadow-md transition-shadow', className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn('text-3xl font-bold', valueClassName)}>
            {value}
          </div>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2 mt-1">
              {trend && (
                <span className={cn(
                  'text-xs font-medium',
                  trend.positive ? 'text-success' : 'text-destructive'
                )}>
                  {trend.positive ? '+' : ''}{trend.value}%
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

StatsCard.displayName = 'StatsCard';
