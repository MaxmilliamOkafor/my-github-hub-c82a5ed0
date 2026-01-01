import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Download,
  Eye,
  Search,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { useApplications } from '@/hooks/useApplications';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Applications = () => {
  const { applications, isLoading, deleteApplications } = useApplications();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingApplication, setViewingApplication] = useState<any | null>(null);

  const filteredApplications = useMemo(() => {
    if (!searchTerm) return applications;
    const lower = searchTerm.toLowerCase();
    return applications.filter(
      (app) =>
        app.job?.title?.toLowerCase().includes(lower) ||
        app.job?.company?.toLowerCase().includes(lower)
    );
  }, [applications, searchTerm]);

  const handleSelectAll = () => {
    if (selectedIds.length === filteredApplications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredApplications.map((app) => app.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await deleteApplications(selectedIds);
    setSelectedIds([]);
  };

  const handleCopy = async (text: string, id: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(`${id}-${type}`);
    toast.success(`${type === 'resume' ? 'Resume' : 'Cover letter'} copied!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPDF = (content: string, filename: string) => {
    // Create a simple text file download (real PDF would require library)
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <Badge className="bg-info/10 text-info border-info/30">Applied</Badge>;
      case 'interviewing':
        return <Badge className="bg-warning/10 text-warning border-warning/30">Interviewing</Badge>;
      case 'offered':
        return <Badge className="bg-success/10 text-success border-success/30">Offered</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const stats = useMemo(() => {
    const total = applications.length;
    const applied = applications.filter((a) => a.status === 'applied').length;
    const interviewing = applications.filter((a) => a.status === 'interviewing').length;
    const offered = applications.filter((a) => a.status === 'offered').length;
    const rejected = applications.filter((a) => a.status === 'rejected').length;
    return { total, applied, interviewing, offered, rejected };
  }, [applications]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Applications</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your tailored resumes and cover letters
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <CheckCircle className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.applied}</p>
                  <p className="text-xs text-muted-foreground">Applied</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <MessageSquare className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.interviewing}</p>
                  <p className="text-xs text-muted-foreground">Interviewing</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.offered}</p>
                  <p className="text-xs text-muted-foreground">Offered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by job title or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedIds.length})
            </Button>
          )}
        </div>

        {/* Applications Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold mb-2">No applications yet</h3>
                <p className="text-muted-foreground text-sm">
                  Start applying to jobs to see your tailored resumes and cover letters here.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === filteredApplications.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(app.id)}
                          onCheckedChange={() => handleSelectOne(app.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {app.job?.title || 'Unknown Job'}
                      </TableCell>
                      <TableCell>{app.job?.company || 'Unknown'}</TableCell>
                      <TableCell>{getStatusBadge(app.status || 'pending')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {app.applied_at
                            ? format(new Date(app.applied_at), 'MMM d, yyyy')
                            : 'Not applied'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingApplication(app)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
                              <DialogHeader>
                                <DialogTitle>
                                  {app.job?.title} at {app.job?.company}
                                </DialogTitle>
                              </DialogHeader>
                              <Tabs defaultValue="resume" className="mt-4">
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="resume">Tailored Resume</TabsTrigger>
                                  <TabsTrigger value="cover">Cover Letter</TabsTrigger>
                                </TabsList>
                                <TabsContent value="resume" className="mt-4">
                                  <div className="flex gap-2 mb-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleCopy(
                                          app.tailored_resume || '',
                                          app.id,
                                          'resume'
                                        )
                                      }
                                    >
                                      {copiedId === `${app.id}-resume` ? (
                                        <Check className="h-4 w-4 mr-1" />
                                      ) : (
                                        <Copy className="h-4 w-4 mr-1" />
                                      )}
                                      Copy
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleDownloadPDF(
                                          app.tailored_resume || '',
                                          `resume-${app.job?.company || 'job'}`
                                        )
                                      }
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </Button>
                                  </div>
                                  <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
                                    <pre className="whitespace-pre-wrap text-sm">
                                      {app.tailored_resume || 'No tailored resume available'}
                                    </pre>
                                  </ScrollArea>
                                </TabsContent>
                                <TabsContent value="cover" className="mt-4">
                                  <div className="flex gap-2 mb-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleCopy(
                                          app.tailored_cover_letter || '',
                                          app.id,
                                          'cover'
                                        )
                                      }
                                    >
                                      {copiedId === `${app.id}-cover` ? (
                                        <Check className="h-4 w-4 mr-1" />
                                      ) : (
                                        <Copy className="h-4 w-4 mr-1" />
                                      )}
                                      Copy
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleDownloadPDF(
                                          app.tailored_cover_letter || '',
                                          `cover-letter-${app.job?.company || 'job'}`
                                        )
                                      }
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </Button>
                                  </div>
                                  <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
                                    <pre className="whitespace-pre-wrap text-sm">
                                      {app.tailored_cover_letter ||
                                        'No tailored cover letter available'}
                                    </pre>
                                  </ScrollArea>
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>
                          {app.job?.url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(app.job?.url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Applications;
