import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile, type Profile } from '@/hooks/useProfile';
import { CVUpload } from '@/components/profile/CVUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiUsageChart } from '@/components/profile/ApiUsageChart';
import { 
  User, Briefcase, GraduationCap, Award, Download, Save, Plus, X, 
  Shield, CheckCircle, Globe, FileText, Languages, Key,
  Loader2, Activity, Zap, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

// Default ATS answers that pass knockout questions
const DEFAULT_ATS_ANSWERS = {
  willing_to_relocate: true,
  visa_required: false,
  veteran_status: false,
  disability: false,
  security_clearance: true,
  driving_license: true,
  over18: true,
  legalToWork: true,
  backgroundCheckConsent: true,
  drugTestConsent: true,
  nonCompeteAgreement: false,
  immediateStart: true,
  flexibleSchedule: true,
  travelWillingness: true,
  remoteWorkCapable: true,
};

const Profile = () => {
  const { user } = useAuth();
  const { profile, isLoading, updateProfile, loadCVData } = useProfile();
  const [editMode, setEditMode] = useState(false);
  const [localProfile, setLocalProfile] = useState<Partial<Profile>>({});
  const [newSkill, setNewSkill] = useState({ name: '', years: 7, category: 'technical' as const });
  // API key is always hidden for security - no toggle
  const [isTestingKey, setIsTestingKey] = useState(false);

  // Note: API usage stats are now shown in the ApiUsageChart component

  const testApiKey = async () => {
    if (!localProfile.openai_api_key) {
      toast.error('Please enter an API key first');
      return;
    }
    
    setIsTestingKey(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-openai-key', {
        body: { apiKey: localProfile.openai_api_key }
      });
      
      if (error) throw error;
      
      if (data.valid) {
        toast.success(data.message);
        if (!data.hasGpt4oMini) {
          toast.warning('Note: GPT-4o-mini may not be available on your account');
        }
      } else {
        toast.error(data.error || 'Invalid API key');
      }
    } catch (error: any) {
      console.error('API key test error:', error);
      toast.error(error.message || 'Failed to validate API key');
    } finally {
      setIsTestingKey(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
    }
  }, [profile]);

  const handleLoadCV = async () => {
    await loadCVData();
  };

  const handleSave = async () => {
    await updateProfile(localProfile);
    setEditMode(false);
  };

  const updateLocalField = (field: keyof Profile, value: any) => {
    setLocalProfile(prev => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    if (!newSkill.name.trim()) return;
    const skills = [...(localProfile.skills || []), newSkill];
    updateLocalField('skills', skills);
    setNewSkill({ name: '', years: 7, category: 'technical' });
  };

  const removeSkill = (index: number) => {
    const skills = [...(localProfile.skills || [])];
    skills.splice(index, 1);
    updateLocalField('skills', skills);
  };

  const addCertification = (cert: string) => {
    if (!cert.trim()) return;
    const certs = [...(localProfile.certifications || []), cert];
    updateLocalField('certifications', certs);
  };

  const removeCertification = (index: number) => {
    const certs = [...(localProfile.certifications || [])];
    certs.splice(index, 1);
    updateLocalField('certifications', certs);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  const hasApiKey = !!localProfile.openai_api_key;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Warning Banner for Missing API Key */}
        {!hasApiKey && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>OpenAI API key is missing.</strong> AI-powered resume tailoring and question answering features are disabled.
              </span>
              <a href="#api-key-section" className="underline font-medium ml-2">
                Add API key below
              </a>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">Your CV data for auto-applications</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleLoadCV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Load Sample CV
            </Button>
            {editMode ? (
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            ) : (
              <Button onClick={() => setEditMode(true)} variant="secondary">
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* CV Upload */}
        <CVUpload
          cvFileName={localProfile.cv_file_name}
          cvFilePath={localProfile.cv_file_path}
          cvUploadedAt={localProfile.cv_uploaded_at}
          onUploadComplete={(path, fileName) => {
            updateLocalField('cv_file_path', path);
            updateLocalField('cv_file_name', fileName);
            updateLocalField('cv_uploaded_at', new Date().toISOString());
            // Auto-save when CV is uploaded
            updateProfile({
              cv_file_path: path,
              cv_file_name: fileName,
              cv_uploaded_at: new Date().toISOString(),
            });
          }}
          onDelete={() => {
            updateLocalField('cv_file_path', null);
            updateLocalField('cv_file_name', null);
            updateLocalField('cv_uploaded_at', null);
            updateProfile({
              cv_file_path: null,
              cv_file_name: null,
              cv_uploaded_at: null,
            });
          }}
          onParsedData={(parsedData) => {
            // Update local profile with parsed data
            const updates: Partial<typeof localProfile> = {};
            
            if (parsedData.first_name) updates.first_name = parsedData.first_name;
            if (parsedData.last_name) updates.last_name = parsedData.last_name;
            if (parsedData.email) updates.email = parsedData.email;
            if (parsedData.phone) updates.phone = parsedData.phone;
            if (parsedData.city) updates.city = parsedData.city;
            if (parsedData.country) updates.country = parsedData.country;
            if (parsedData.linkedin) updates.linkedin = parsedData.linkedin;
            if (parsedData.github) updates.github = parsedData.github;
            if (parsedData.portfolio) updates.portfolio = parsedData.portfolio;
            if (parsedData.total_experience) updates.total_experience = parsedData.total_experience;
            if (parsedData.highest_education) updates.highest_education = parsedData.highest_education;
            if (parsedData.current_salary) updates.current_salary = parsedData.current_salary;
            if (parsedData.expected_salary) updates.expected_salary = parsedData.expected_salary;
            if (parsedData.skills && parsedData.skills.length > 0) updates.skills = parsedData.skills;
            if (parsedData.certifications && parsedData.certifications.length > 0) updates.certifications = parsedData.certifications;
            if (parsedData.work_experience && parsedData.work_experience.length > 0) updates.work_experience = parsedData.work_experience;
            if (parsedData.education && parsedData.education.length > 0) updates.education = parsedData.education;
            if (parsedData.languages && parsedData.languages.length > 0) updates.languages = parsedData.languages;
            if (parsedData.cover_letter) updates.cover_letter = parsedData.cover_letter;
            
            // Update local state
            setLocalProfile(prev => ({ ...prev, ...updates }));
            
            // Save to database
            updateProfile(updates);
          }}
        />

        {/* OpenAI API Key */}
        <Card id="api-key-section" className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              OpenAI API Key (Required for AI Features)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your OpenAI API key to enable AI-powered resume tailoring and cover letter generation. 
              Your key is stored securely and only used for your own applications.
            </p>
            <div className="flex gap-2">
              <Input 
                type="password"
                placeholder="sk-..."
                value={localProfile.openai_api_key || ''}
                onChange={(e) => updateLocalField('openai_api_key', e.target.value)}
                className="flex-1"
              />
              <Button 
                variant="outline"
                onClick={testApiKey}
                disabled={!localProfile.openai_api_key || isTestingKey}
              >
                {isTestingKey ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Test Key
                  </>
                )}
              </Button>
              <Button 
                onClick={() => {
                  if (localProfile.openai_api_key) {
                    updateProfile({ openai_api_key: localProfile.openai_api_key });
                    toast.success('API key saved!');
                  }
                }}
                disabled={!localProfile.openai_api_key}
              >
                Save Key
              </Button>
            </div>
            {localProfile.openai_api_key && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                API key configured - AI features enabled
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                OpenAI Platform
              </a>
              . Uses GPT-4o-mini for cost-effective AI tailoring.
            </p>
          </CardContent>
        </Card>

        {/* API Usage Chart */}
        <ApiUsageChart />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>First Name</Label>
              <Input 
                value={localProfile.first_name || ''} 
                onChange={(e) => updateLocalField('first_name', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input 
                value={localProfile.last_name || ''} 
                onChange={(e) => updateLocalField('last_name', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                value={localProfile.email || ''} 
                onChange={(e) => updateLocalField('email', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input 
                value={localProfile.phone || ''} 
                onChange={(e) => updateLocalField('phone', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>City</Label>
              <Input 
                value={localProfile.city || ''} 
                onChange={(e) => updateLocalField('city', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input 
                value={localProfile.country || ''} 
                onChange={(e) => updateLocalField('country', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Total Experience</Label>
              <Input 
                value={localProfile.total_experience || ''} 
                onChange={(e) => updateLocalField('total_experience', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Notice Period</Label>
              <Input 
                value={localProfile.notice_period || ''} 
                onChange={(e) => updateLocalField('notice_period', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>LinkedIn</Label>
              <Input 
                value={localProfile.linkedin || ''} 
                onChange={(e) => updateLocalField('linkedin', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>GitHub</Label>
              <Input 
                value={localProfile.github || ''} 
                onChange={(e) => updateLocalField('github', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Portfolio</Label>
              <Input 
                value={localProfile.portfolio || ''} 
                onChange={(e) => updateLocalField('portfolio', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Highest Education</Label>
              <Input 
                value={localProfile.highest_education || ''} 
                onChange={(e) => updateLocalField('highest_education', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Current Salary</Label>
              <Input 
                value={localProfile.current_salary || ''} 
                onChange={(e) => updateLocalField('current_salary', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label>Expected Salary</Label>
              <Input 
                value={localProfile.expected_salary || ''} 
                onChange={(e) => updateLocalField('expected_salary', e.target.value)}
                readOnly={!editMode} 
                className="mt-1" 
              />
            </div>
          </CardContent>
        </Card>

        {/* ATS Knockout Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              ATS Knockout Questions (Auto-Pass Answers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              These answers are optimized to pass ATS screening. Toggle to adjust.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Are you 18 years or older?</span>
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-green-500" />
                  <span>Legally authorized to work?</span>
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Willing to relocate?</span>
                <Switch 
                  checked={localProfile.willing_to_relocate ?? true}
                  onCheckedChange={(v) => updateLocalField('willing_to_relocate', v)}
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Requires visa sponsorship?</span>
                <Switch 
                  checked={localProfile.visa_required ?? false}
                  onCheckedChange={(v) => updateLocalField('visa_required', v)}
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Veteran status?</span>
                <Switch 
                  checked={localProfile.veteran_status ?? false}
                  onCheckedChange={(v) => updateLocalField('veteran_status', v)}
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Have a disability?</span>
                <Switch 
                  checked={localProfile.disability ?? false}
                  onCheckedChange={(v) => updateLocalField('disability', v)}
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Security clearance?</span>
                <Switch 
                  checked={localProfile.security_clearance ?? true}
                  onCheckedChange={(v) => updateLocalField('security_clearance', v)}
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Driving license?</span>
                <Switch 
                  checked={localProfile.driving_license ?? true}
                  onCheckedChange={(v) => updateLocalField('driving_license', v)}
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Consent to background check?</span>
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Consent to drug test?</span>
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Willing to travel?</span>
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Remote work capable?</span>
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
            </div>
            
            {/* Gender */}
            <div className="mt-4">
              <Label>Gender (EEO)</Label>
              {editMode ? (
                <Select 
                  value={localProfile.gender || ''}
                  onValueChange={(v) => updateLocalField('gender', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Non-binary">Non-binary</SelectItem>
                    <SelectItem value="Prefer not to answer">Prefer not to answer</SelectItem>
                    <SelectItem value="Decline to self-identify">Decline to self-identify</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value={localProfile.gender || ''} readOnly className="mt-1" />
              )}
            </div>
            
            {/* Hispanic/Latino */}
            <div className="flex items-center justify-between p-3 border rounded-lg mt-4">
              <span>Are you Hispanic/Latino?</span>
              <Switch 
                checked={localProfile.hispanic_latino ?? false}
                onCheckedChange={(v) => updateLocalField('hispanic_latino', v)}
                disabled={!editMode}
              />
            </div>
            
            {/* Race/Ethnicity */}
            <div className="mt-4">
              <Label>Race/Ethnicity (EEO)</Label>
              {editMode ? (
                <Select 
                  value={localProfile.race_ethnicity || ''}
                  onValueChange={(v) => updateLocalField('race_ethnicity', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Decline to self-identify">Decline to self-identify</SelectItem>
                    <SelectItem value="White">White</SelectItem>
                    <SelectItem value="Black or African American">Black or African American</SelectItem>
                    <SelectItem value="Hispanic or Latino">Hispanic or Latino</SelectItem>
                    <SelectItem value="Asian">Asian</SelectItem>
                    <SelectItem value="Native American">Native American</SelectItem>
                    <SelectItem value="Two or More Races">Two or More Races</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value={localProfile.race_ethnicity || ''} readOnly className="mt-1" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Skills - Editable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Skills ({(localProfile.skills || []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode && (
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Skill name" 
                  value={newSkill.name}
                  onChange={(e) => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
                  className="flex-1"
                />
                <Input 
                  type="number"
                  placeholder="Years"
                  value={newSkill.years}
                  onChange={(e) => setNewSkill(prev => ({ ...prev, years: parseInt(e.target.value) || 7 }))}
                  className="w-20"
                />
                <Select 
                  value={newSkill.category}
                  onValueChange={(v: any) => setNewSkill(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="tools">Tools</SelectItem>
                    <SelectItem value="soft">Soft Skills</SelectItem>
                    <SelectItem value="languages">Languages</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addSkill} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(localProfile.skills || []).map((skill: any, i: number) => (
                <Badge 
                  key={i} 
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {skill.name} • {skill.years}y
                  {editMode && (
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeSkill(i)}
                    />
                  )}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Skills not in your profile will default to 7 years for automation
            </p>
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode && (
              <div className="flex gap-2 mb-4">
                <Input 
                  placeholder="Add certification" 
                  id="newCert"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addCertification((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  onClick={() => {
                    const input = document.getElementById('newCert') as HTMLInputElement;
                    addCertification(input.value);
                    input.value = '';
                  }}
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(localProfile.certifications || []).map((cert: string, i: number) => (
                <Badge 
                  key={i} 
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  {cert}
                  {editMode && (
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeCertification(i)}
                    />
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Languages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Languages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(localProfile.languages || []).map((lang: any, i: number) => (
                <Badge key={i} variant="secondary">
                  {lang.name} - {lang.proficiency}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Work Experience */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Work Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(localProfile.work_experience || []).map((exp: any) => (
              <div key={exp.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{exp.title}</h3>
                    <p className="text-muted-foreground">{exp.company} • {exp.location}</p>
                  </div>
                  <Badge variant="outline">{exp.startDate} - {exp.endDate}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(exp.skills || []).slice(0, 6).map((skill: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Education */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(localProfile.education || []).map((edu: any) => (
              <div key={edu.id} className="border rounded-lg p-4">
                <h3 className="font-semibold">{edu.degree}</h3>
                <p className="text-muted-foreground">{edu.institution}</p>
                <p className="text-sm text-muted-foreground mt-1">GPA: {edu.gpa}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cover Letter */}
        <Card>
          <CardHeader>
            <CardTitle>Cover Letter</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={localProfile.cover_letter || ''} 
              onChange={(e) => updateLocalField('cover_letter', e.target.value)}
              readOnly={!editMode} 
              className="min-h-[300px] font-mono text-sm"
            />
          </CardContent>
        </Card>

        {/* ATS Strategy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              ATS Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={localProfile.ats_strategy || ''} 
              onChange={(e) => updateLocalField('ats_strategy', e.target.value)}
              readOnly={!editMode} 
              className="min-h-[150px] text-sm"
              placeholder="Instructions for how the AI should answer ATS questions..."
            />
          </CardContent>
        </Card>

        {/* Excluded Companies */}
        <Card>
          <CardHeader>
            <CardTitle>Excluded Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(localProfile.excluded_companies || []).map((company: string, i: number) => (
                <Badge key={i} variant="destructive" className="text-xs">
                  {company}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;
