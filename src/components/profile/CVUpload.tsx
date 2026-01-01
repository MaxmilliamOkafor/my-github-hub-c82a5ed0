import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Loader2, Download, Sparkles } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParsedCVData {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  total_experience?: string | null;
  highest_education?: string | null;
  current_salary?: string | null;
  expected_salary?: string | null;
  skills?: Array<{ name: string; years: number; category: string }>;
  certifications?: string[];
  work_experience?: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
  }>;
  languages?: Array<{ language: string; proficiency: string }>;
  cover_letter?: string | null;
}

interface CVUploadProps {
  cvFileName?: string | null;
  cvFilePath?: string | null;
  cvUploadedAt?: string | null;
  onUploadComplete: (path: string, fileName: string) => void;
  onDelete: () => void;
  onParsedData?: (data: ParsedCVData) => void;
}

export function CVUpload({ cvFileName, cvFilePath, cvUploadedAt, onUploadComplete, onDelete, onParsedData }: CVUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showParseConfirm, setShowParseConfirm] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      if (cvFilePath) {
        await supabase.storage.from('cvs').remove([cvFilePath]);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('cvs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      onUploadComplete(fileName, file.name);
      toast.success('CV uploaded successfully!');
      
      if (onParsedData) {
        setPendingFilePath(fileName);
        setShowParseConfirm(true);
      }
    } catch (error) {
      console.error('Error uploading CV:', error);
      toast.error('Failed to upload CV');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleParseCV = async (filePath: string) => {
    if (!onParsedData) {
      toast.info('CV parsing is not available in this context');
      return;
    }

    setIsParsing(true);
    setShowParseConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke('parse-cv', {
        body: { cvFilePath: filePath }
      });

      if (error) throw error;

      if (data.success && data.data) {
        onParsedData(data.data);
        toast.success('CV parsed successfully! Your profile has been updated.');
      } else {
        throw new Error(data.error || 'Failed to parse CV');
      }
    } catch (error: any) {
      console.error('Error parsing CV:', error);
      toast.error(error.message || 'Failed to parse CV. Please fill in your details manually.');
    } finally {
      setIsParsing(false);
      setPendingFilePath(null);
    }
  };

  const handleDelete = async () => {
    if (!cvFilePath || !user) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase.storage
        .from('cvs')
        .remove([cvFilePath]);

      if (error) throw error;

      onDelete();
      toast.success('CV deleted');
    } catch (error) {
      console.error('Error deleting CV:', error);
      toast.error('Failed to delete CV');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!cvFilePath) return;

    try {
      const { data, error } = await supabase.storage
        .from('cvs')
        .download(cvFilePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = cvFileName || 'cv.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CV:', error);
      toast.error('Failed to download CV');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume / CV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {cvFilePath && cvFileName ? (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{cvFileName}</p>
                  {cvUploadedAt && (
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(cvUploadedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {onParsedData && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleParseCV(cvFilePath)}
                    disabled={isParsing}
                    title="Parse CV to auto-fill profile"
                  >
                    {isParsing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownload} title="Download CV">
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  title="Delete CV"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-center mb-4">
                Upload your CV/Resume (PDF or Word, max 10MB)
              </p>
            </div>
          )}

          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isParsing}
            className="w-full"
            variant={cvFilePath ? 'outline' : 'default'}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : isParsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing CV...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {cvFilePath ? 'Replace CV' : 'Upload CV'}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your CV is stored securely and can be parsed to auto-fill your profile
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={showParseConfirm} onOpenChange={setShowParseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Parse CV to Auto-Fill Profile?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to use AI to extract information from your CV and automatically fill in your profile? This will update your personal details, skills, work experience, and education.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFilePath(null)}>
              No, I'll fill manually
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingFilePath && handleParseCV(pendingFilePath)}>
              Yes, Parse CV
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
