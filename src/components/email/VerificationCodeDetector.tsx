import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  KeyRound, 
  Copy, 
  Check, 
  RefreshCw, 
  Loader2, 
  Mail,
  Clock,
  Trash2
} from 'lucide-react';

interface VerificationCode {
  id: string;
  code: string;
  source: string;
  subject: string;
  detected_at: string;
  expires_at?: string;
  used: boolean;
}

export function VerificationCodeDetector() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<VerificationCode[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Fetch detected codes
  const fetchCodes = async () => {
    if (!user) return;

    try {
      // Get recent email detections and extract codes
      const { data, error } = await supabase
        .from('email_detections')
        .select('*')
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Parse codes from email bodies
      const detectedCodes: VerificationCode[] = [];
      
      for (const email of data || []) {
        const extractedCodes = extractVerificationCodes(email.email_body || '', email.email_subject);
        for (const code of extractedCodes) {
          detectedCodes.push({
            id: `${email.id}-${code}`,
            code,
            source: email.email_from,
            subject: email.email_subject,
            detected_at: email.detected_at,
            used: false,
          });
        }
      }

      setCodes(detectedCodes);
    } catch (error) {
      console.error('Error fetching codes:', error);
    }
  };

  useEffect(() => {
    fetchCodes();
    // Poll for new codes every 10 seconds when scanning
    const interval = setInterval(fetchCodes, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Extract verification codes from email content
  const extractVerificationCodes = (body: string, subject: string): string[] => {
    const codes: string[] = [];
    const text = `${subject} ${body}`;
    
    // Common patterns for verification codes
    const patterns = [
      // 6-digit codes (most common)
      /\b(\d{6})\b/g,
      // 4-digit codes
      /\b(\d{4})\b/g,
      // 8-digit codes
      /\b(\d{8})\b/g,
      // Alphanumeric codes like ABC123 or 123ABC
      /\b([A-Z0-9]{6,8})\b/gi,
      // Codes with specific prefixes
      /(?:code|pin|otp|verification|confirm)[:\s]*([A-Z0-9]{4,8})/gi,
      // Codes in specific formats
      /\b(\d{3}[-\s]?\d{3})\b/g,
    ];

    // Keywords that suggest a verification code email
    const verificationKeywords = [
      'verification', 'verify', 'code', 'otp', 'pin', 
      'confirm', 'authentication', 'security', 'login',
      'sign in', 'access', 'one-time', 'temporary'
    ];

    const hasVerificationContext = verificationKeywords.some(
      keyword => text.toLowerCase().includes(keyword)
    );

    if (hasVerificationContext) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const code = match[1].replace(/[-\s]/g, '');
          // Filter out unlikely codes (years, common numbers)
          if (code.length >= 4 && code.length <= 8 && !isUnlikelyCode(code)) {
            if (!codes.includes(code)) {
              codes.push(code);
            }
          }
        }
      }
    }

    return codes.slice(0, 3); // Return max 3 codes per email
  };

  const isUnlikelyCode = (code: string): boolean => {
    // Filter out years, phone numbers, etc.
    const year = parseInt(code);
    if (year >= 1900 && year <= 2100) return true;
    if (code === '0000' || code === '1234' || code === '123456') return true;
    return false;
  };

  const scanForCodes = async () => {
    if (!user) return;

    setIsScanning(true);
    try {
      // Trigger email scan via edge function
      const { data: integration } = await supabase
        .from('email_integrations')
        .select('access_token, is_connected')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!integration?.is_connected) {
        toast.error('Please connect Gmail first');
        return;
      }

      const { error } = await supabase.functions.invoke('process-email', {
        body: {
          type: 'detect_responses',
          userId: user.id,
          accessToken: integration.access_token,
        }
      });

      if (error) throw error;

      await fetchCodes();
      toast.success('Scanned for verification codes');
    } catch (error) {
      console.error('Error scanning:', error);
      toast.error('Failed to scan emails');
    } finally {
      setIsScanning(false);
    }
  };

  const copyCode = async (code: VerificationCode) => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopiedId(code.id);
      toast.success('Code copied to clipboard!');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const addManualCode = () => {
    if (!manualCode.trim()) return;
    
    const newCode: VerificationCode = {
      id: `manual-${Date.now()}`,
      code: manualCode.trim(),
      source: 'Manual entry',
      subject: 'Manually added code',
      detected_at: new Date().toISOString(),
      used: false,
    };
    
    setCodes(prev => [newCode, ...prev]);
    setManualCode('');
    toast.success('Code added');
  };

  const removeCode = (id: string) => {
    setCodes(prev => prev.filter(c => c.id !== id));
  };

  const getTimeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Verification Codes
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={scanForCodes}
            disabled={isScanning}
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual code entry */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter code manually..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManualCode()}
            className="flex-1"
          />
          <Button onClick={addManualCode} size="sm" disabled={!manualCode.trim()}>
            Add
          </Button>
        </div>

        {/* Detected codes */}
        {codes.length > 0 ? (
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {codes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xl font-bold tracking-wider text-primary">
                      {code.code}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{code.source}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeAgo(code.detected_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyCode(code)}
                      className="h-8 w-8"
                    >
                      {copiedId === code.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCode(code.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No verification codes detected</p>
            <p className="text-xs mt-1">Codes from emails will appear here automatically</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Verification codes are detected from your connected email. Click to copy.
        </p>
      </CardContent>
    </Card>
  );
}