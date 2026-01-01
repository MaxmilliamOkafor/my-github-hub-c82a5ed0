import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CSVUploadProps {
  onUpload: (urls: string[]) => void;
}

export function CSVUpload({ onUpload }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const processCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const urls: string[] = [];
    
    lines.forEach(line => {
      const columns = line.split(',');
      columns.forEach(col => {
        const trimmed = col.trim().replace(/^["']|["']$/g, '');
        if (trimmed.match(/^https?:\/\//)) {
          urls.push(trimmed);
        }
      });
    });

    return urls;
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const urls = processCSV(text);
      
      if (urls.length > 0) {
        setUploadedCount(urls.length);
        onUpload(urls);
        toast.success(`Found ${urls.length} job URLs to process`);
      } else {
        toast.error('No valid URLs found in CSV');
      }
    };
    reader.readAsText(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Upload Job URLs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop a CSV file with job URLs
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            or click to browse
          </p>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            id="csv-upload"
            onChange={handleFileInput}
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor="csv-upload" className="cursor-pointer">
              Select CSV File
            </label>
          </Button>
        </div>

        {uploadedCount > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            {uploadedCount} URLs ready for processing
          </div>
        )}

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            CSV should contain job URLs from supported platforms: Workday, SmartRecruiters, iCIMS, Bullhorn, etc.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
