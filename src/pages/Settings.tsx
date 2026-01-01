import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { atsPlatforms } from '@/data/mockJobs';
import { Building2, Zap } from 'lucide-react';

const Settings = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supported ATS Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {atsPlatforms.map((platform) => (
                <Badge key={platform} variant="secondary">{platform}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-semibold">Unlimited Applications</p>
                <p className="text-sm text-muted-foreground">No daily limits - apply to as many jobs as you want</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
