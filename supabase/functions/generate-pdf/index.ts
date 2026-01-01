import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResumeData {
  type: 'resume' | 'cover_letter';
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary?: string;
  experience?: Array<{
    company: string;
    title: string;
    dates: string;
    bullets: string[];
  }>;
  education?: Array<{
    degree: string;
    school: string;
    dates: string;
    gpa?: string;
  }>;
  skills?: {
    primary: string[];
    secondary?: string[];
  };
  certifications?: string[];
  achievements?: Array<{
    title: string;
    date: string;
    description: string;
  }>;
  coverLetter?: {
    recipientCompany: string;
    jobTitle: string;
    jobId?: string;
    paragraphs: string[];
  };
  customFileName?: string;
  candidateName?: string;
}

// ULTRA ATS-SAFE: Sanitize text - only ASCII, no special characters
const sanitizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text)
    // Remove all newlines, tabs
    .replace(/[\n\r\t]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Smart quotes to straight quotes
    .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    // Dashes to hyphen
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    // Ellipsis to dots
    .replace(/\u2026/g, '...')
    // All bullet points to hyphen
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25A0\u25A1\u25CF\u25CB\u25D8\u25D9\u2B24\u2B58\u29BF\u25C6\u25C7\u2666\u2756\u2605\u2606\u2713\u2714\u2717\u2718\u2794\u27A4\u25B6\u25B8\u25BA\u25BC\u25BE\u25C0\u25C2\u25C4]/g, '-')
    // Arrows to text
    .replace(/[\u2190-\u21FF]/g, '->')
    // Check marks to asterisk
    .replace(/[\u2713\u2714\u2715\u2716\u2717\u2718]/g, '*')
    // Symbols to text equivalents
    .replace(/\u00A9/g, '(c)')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u20AC/g, 'EUR')
    .replace(/\u00A3/g, 'GBP')
    .replace(/\u00A5/g, 'JPY')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    // Remove any remaining non-ASCII
    .replace(/[^\x00-\x7F\u00A0-\u00FF]/g, ' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Check if this is a raw content request (from extension)
    if (requestBody.content && typeof requestBody.content === 'string') {
      return handleRawContentRequest(requestBody);
    }
    
    // Otherwise, handle structured data request
    const data: ResumeData = requestBody;
    console.log('Generating ULTRA ATS-COMPATIBLE PDF for:', data.type, data.personalInfo?.name);

    // Deep sanitize all string fields
    const sanitizeObject = (obj: unknown): unknown => {
      if (typeof obj === 'string') return sanitizeText(obj);
      if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = sanitizeObject(value);
        }
        return result;
      }
      return obj;
    };
    
    const sanitizedData = sanitizeObject(data) as ResumeData;

    const pdfDoc = await PDFDocument.create();
    
    // Set PDF metadata for better ATS parsing
    pdfDoc.setTitle(sanitizedData.type === 'resume' 
      ? `${sanitizedData.personalInfo.name} - Resume`
      : `${sanitizedData.personalInfo.name} - Cover Letter`);
    pdfDoc.setAuthor(sanitizedData.personalInfo.name);
    pdfDoc.setSubject(sanitizedData.type === 'resume' ? 'Professional Resume' : 'Cover Letter');
    pdfDoc.setKeywords(['resume', 'cv', 'professional']);
    pdfDoc.setCreator('QuantumHire ATS Optimizer');
    pdfDoc.setProducer('QuantumHire');
    
    // Use only standard fonts - maximum ATS compatibility
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Standard Letter size
    const PAGE_WIDTH = 612;
    const PAGE_HEIGHT = 792;
    const MARGIN = 54; // 0.75 inch margins - standard
    const LINE_HEIGHT = 14;
    const SECTION_GAP = 16;

    // ULTRA ATS: Only black and dark gray - no colors
    const colors = {
      black: rgb(0, 0, 0),
      darkGray: rgb(0.15, 0.15, 0.15),
    };

    // Page management
    const pages: PDFPage[] = [];
    const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(firstPage);
    let currentPage: PDFPage = firstPage;
    let yPosition: number = PAGE_HEIGHT - MARGIN;

    const addNewPage = (): PDFPage => {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(page);
      yPosition = PAGE_HEIGHT - MARGIN;
      currentPage = page;
      return page;
    };

    const ensureSpace = (neededSpace: number): void => {
      if (yPosition < MARGIN + neededSpace) {
        addNewPage();
      }
    };

    // Text wrapping - simple linear flow for ATS
    const wrapText = (text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] => {
      const cleanText = sanitizeText(text);
      const words = cleanText.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if (!word) continue;
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // Draw wrapped text with automatic page breaks
    const drawWrappedText = (text: string, x: number, fontSize: number, font: PDFFont, maxWidth?: number): void => {
      const effectiveMaxWidth = maxWidth || (PAGE_WIDTH - MARGIN - x);
      const lines = wrapText(text, effectiveMaxWidth, font, fontSize);
      
      for (const line of lines) {
        ensureSpace(fontSize + 4);
        currentPage.drawText(line, { 
          x, 
          y: yPosition, 
          size: fontSize, 
          font, 
          color: colors.black 
        });
        yPosition -= LINE_HEIGHT;
      }
    };

    // ULTRA ATS SECTION HEADER - Plain text, bold, no decorations
    const drawSectionHeader = (title: string): void => {
      yPosition -= SECTION_GAP;
      ensureSpace(20);
      
      // Just bold uppercase text - no lines, no colors
      currentPage.drawText(title.toUpperCase(), {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font: helveticaBold,
        color: colors.black,
      });
      yPosition -= LINE_HEIGHT + 4;
    };

    if (sanitizedData.type === 'resume') {
      // ============================================
      // ULTRA ATS-COMPATIBLE RESUME FORMAT
      // ============================================
      
      // NAME - Large, bold, centered would confuse some ATS, so left-aligned
      currentPage.drawText(sanitizedData.personalInfo.name.toUpperCase(), {
        x: MARGIN,
        y: yPosition,
        size: 18,
        font: helveticaBold,
        color: colors.black,
      });
      yPosition -= 22;

      // CONTACT LINE - Simple pipe-separated, all on one or two lines
      const contactParts: string[] = [];
      if (sanitizedData.personalInfo.phone) contactParts.push(sanitizedData.personalInfo.phone);
      if (sanitizedData.personalInfo.email) contactParts.push(sanitizedData.personalInfo.email);
      if (sanitizedData.personalInfo.location) contactParts.push(sanitizedData.personalInfo.location);
      
      if (contactParts.length > 0) {
        const contactLine = contactParts.join(' | ');
        drawWrappedText(contactLine, MARGIN, 10, helvetica);
      }

      // LINKS - Plain text URLs
      const linkParts: string[] = [];
      if (sanitizedData.personalInfo.linkedin) linkParts.push(sanitizedData.personalInfo.linkedin);
      if (sanitizedData.personalInfo.github) linkParts.push(sanitizedData.personalInfo.github);
      if (sanitizedData.personalInfo.portfolio) linkParts.push(sanitizedData.personalInfo.portfolio);
      
      if (linkParts.length > 0) {
        const linksLine = linkParts.join(' | ');
        drawWrappedText(linksLine, MARGIN, 9, helvetica);
      }

      // === PROFESSIONAL SUMMARY ===
      if (sanitizedData.summary) {
        drawSectionHeader('Professional Summary');
        drawWrappedText(sanitizedData.summary, MARGIN, 10, helvetica);
      }

      // === WORK EXPERIENCE ===
      if (sanitizedData.experience && sanitizedData.experience.length > 0) {
        drawSectionHeader('Work Experience');
        
        for (const exp of sanitizedData.experience) {
          ensureSpace(50);
          
          // Company and dates on same line
          const companyLine = `${exp.company} | ${exp.dates}`;
          currentPage.drawText(companyLine, {
            x: MARGIN,
            y: yPosition,
            size: 11,
            font: helveticaBold,
            color: colors.black,
          });
          yPosition -= LINE_HEIGHT;

          // Job title
          currentPage.drawText(exp.title, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: helvetica,
            color: colors.darkGray,
          });
          yPosition -= LINE_HEIGHT + 2;

          // Bullet points - simple dash prefix
          for (const bullet of exp.bullets) {
            ensureSpace(LINE_HEIGHT * 2);
            const bulletText = `- ${bullet}`;
            drawWrappedText(bulletText, MARGIN, 10, helvetica, PAGE_WIDTH - MARGIN * 2);
          }
          yPosition -= 6;
        }
      }

      // === EDUCATION ===
      if (sanitizedData.education && sanitizedData.education.length > 0) {
        drawSectionHeader('Education');
        
        for (const edu of sanitizedData.education) {
          ensureSpace(30);
          
          // Degree and dates
          const degreeLine = `${edu.degree} | ${edu.dates}`;
          currentPage.drawText(degreeLine, {
            x: MARGIN,
            y: yPosition,
            size: 11,
            font: helveticaBold,
            color: colors.black,
          });
          yPosition -= LINE_HEIGHT;

          // School and GPA
          const schoolLine = edu.gpa ? `${edu.school} | GPA: ${edu.gpa}` : edu.school;
          currentPage.drawText(schoolLine, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: helvetica,
            color: colors.black,
          });
          yPosition -= LINE_HEIGHT + 6;
        }
      }

      // === SKILLS ===
      if (sanitizedData.skills) {
        drawSectionHeader('Skills');
        
        if (sanitizedData.skills.primary && sanitizedData.skills.primary.length > 0) {
          const skillsLine = `Technical: ${sanitizedData.skills.primary.join(', ')}`;
          drawWrappedText(skillsLine, MARGIN, 10, helvetica);
        }
        
        if (sanitizedData.skills.secondary && sanitizedData.skills.secondary.length > 0) {
          const additionalLine = `Additional: ${sanitizedData.skills.secondary.join(', ')}`;
          drawWrappedText(additionalLine, MARGIN, 10, helvetica);
        }
      }

      // === CERTIFICATIONS ===
      if (sanitizedData.certifications && sanitizedData.certifications.length > 0) {
        drawSectionHeader('Certifications');
        // List each certification on its own line for better parsing
        for (const cert of sanitizedData.certifications) {
          ensureSpace(LINE_HEIGHT);
          currentPage.drawText(`- ${cert}`, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: helvetica,
            color: colors.black,
          });
          yPosition -= LINE_HEIGHT;
        }
      }

      // === ACHIEVEMENTS ===
      if (sanitizedData.achievements && sanitizedData.achievements.length > 0) {
        drawSectionHeader('Achievements');
        
        for (const achievement of sanitizedData.achievements) {
          ensureSpace(30);
          currentPage.drawText(`${achievement.title} (${achievement.date})`, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: helveticaBold,
            color: colors.black,
          });
          yPosition -= LINE_HEIGHT;
          
          if (achievement.description) {
            drawWrappedText(achievement.description, MARGIN, 10, helvetica);
          }
          yPosition -= 4;
        }
      }

    } else if (sanitizedData.type === 'cover_letter' && sanitizedData.coverLetter) {
      // ============================================
      // ULTRA ATS-COMPATIBLE COVER LETTER FORMAT
      // ============================================
      
      // Name header
      currentPage.drawText(sanitizedData.personalInfo.name.toUpperCase(), {
        x: MARGIN,
        y: yPosition,
        size: 16,
        font: helveticaBold,
        color: colors.black,
      });
      yPosition -= 20;

      // Contact info
      const contactLine = [
        sanitizedData.personalInfo.phone, 
        sanitizedData.personalInfo.email
      ].filter(Boolean).join(' | ');
      
      if (contactLine) {
        currentPage.drawText(contactLine, {
          x: MARGIN,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: colors.black,
        });
        yPosition -= LINE_HEIGHT * 2;
      }

      // Date
      const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      currentPage.drawText(today, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: colors.black,
      });
      yPosition -= LINE_HEIGHT * 2;

      // Recipient company
      if (sanitizedData.coverLetter.recipientCompany) {
        currentPage.drawText(sanitizedData.coverLetter.recipientCompany, {
          x: MARGIN,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: colors.black,
        });
        yPosition -= LINE_HEIGHT * 2;
      }

      // Subject line - job title only
      const subject = `Re: ${sanitizedData.coverLetter.jobTitle}`;
      currentPage.drawText(subject, {
        x: MARGIN,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: colors.black,
      });
      yPosition -= LINE_HEIGHT * 2;

      // Salutation
      currentPage.drawText('Dear Hiring Committee,', {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: colors.black,
      });
      yPosition -= LINE_HEIGHT * 1.5;

      // Body paragraphs
      for (const paragraph of sanitizedData.coverLetter.paragraphs) {
        drawWrappedText(paragraph, MARGIN, 11, helvetica);
        yPosition -= LINE_HEIGHT * 0.5;
      }

      yPosition -= LINE_HEIGHT;

      // Closing
      currentPage.drawText('Sincerely,', {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: colors.black,
      });
      yPosition -= LINE_HEIGHT * 2;

      // Signature name
      currentPage.drawText(sanitizedData.personalInfo.name, {
        x: MARGIN,
        y: yPosition,
        size: 11,
        font: helveticaBold,
        color: colors.black,
      });
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Generate filename
    let fileName: string;
    if (sanitizedData.customFileName) {
      fileName = sanitizedData.customFileName;
    } else {
      const candidateName = sanitizedData.candidateName || 
        sanitizedData.personalInfo.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      fileName = sanitizedData.type === 'resume' 
        ? `${candidateName}_CV.pdf`
        : `${candidateName}_Cover_Letter.pdf`;
    }

    console.log(`ULTRA ATS PDF generated: ${fileName} Size: ${pdfBytes.length} bytes, Pages: ${pages.length}`);

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    console.error('PDF generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Handle raw content request from extension
 * Parses text content, applies tailoredLocation, and returns base64 PDF in JSON
 */
async function handleRawContentRequest(body: {
  content: string;
  type?: string;
  tailoredLocation?: string;
  jobTitle?: string;
  company?: string;
  fileName?: string;
  firstName?: string;
  lastName?: string;
}): Promise<Response> {
  const { content, type = 'cv', tailoredLocation, jobTitle, company, fileName, firstName, lastName } = body;
  
  console.log('[generate-pdf] Raw content request, tailoredLocation:', tailoredLocation, 'firstName:', firstName, 'lastName:', lastName);
  
  try {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const PAGE_WIDTH = 612;
    const PAGE_HEIGHT = 792;
    const MARGIN = 54;
    const LINE_HEIGHT = 14;
    
    let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let yPosition = PAGE_HEIGHT - MARGIN;
    
    const addNewPage = () => {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      yPosition = PAGE_HEIGHT - MARGIN;
      return currentPage;
    };
    
    const ensureSpace = (needed: number) => {
      if (yPosition < MARGIN + needed) {
        addNewPage();
      }
    };
    
    // Process content line by line
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let isFirstLine = true;
    let headerProcessed = false;
    
    for (const line of lines) {
      // Handle header line with dynamic location replacement
      if (!headerProcessed && line.includes('|') && line.includes('@') && /open to relocation/i.test(line)) {
        const parts = line.split('|').map(p => p.trim());
        // Expected format: phone | email | location | open to relocation
        if (parts.length >= 4 && tailoredLocation) {
          // Replace the location part (index 2) with tailoredLocation
          parts[2] = tailoredLocation;
        }
        
        ensureSpace(LINE_HEIGHT);
        currentPage.drawText(parts.join(' | '), {
          x: MARGIN,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
        yPosition -= LINE_HEIGHT;
        headerProcessed = true;
        continue;
      }
      
      // Handle name line (first line, typically uppercase)
      if (isFirstLine && line === line.toUpperCase() && line.length < 50) {
        ensureSpace(22);
        currentPage.drawText(line, {
          x: MARGIN,
          y: yPosition,
          size: 18,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= 22;
        isFirstLine = false;
        continue;
      }
      isFirstLine = false;
      
      // Handle section headers (all caps)
      const sectionHeaders = ['PROFESSIONAL SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS', 'ACHIEVEMENTS', 'PROJECTS'];
      if (sectionHeaders.some(h => line.toUpperCase().startsWith(h))) {
        yPosition -= 12;
        ensureSpace(20);
        currentPage.drawText(line.toUpperCase().replace(':', ''), {
          x: MARGIN,
          y: yPosition,
          size: 11,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
        yPosition -= LINE_HEIGHT + 4;
        continue;
      }
      
      // Handle bullet points
      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
        ensureSpace(LINE_HEIGHT * 2);
        const bulletText = line.replace(/^[-•*]\s*/, '- ');
        
        // Wrap long bullet points
        const words = bulletText.split(' ');
        let currentLine = '';
        const maxWidth = PAGE_WIDTH - MARGIN * 2;
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, 10);
          
          if (testWidth > maxWidth && currentLine) {
            currentPage.drawText(currentLine, {
              x: MARGIN,
              y: yPosition,
              size: 10,
              font: helvetica,
              color: rgb(0, 0, 0),
            });
            yPosition -= LINE_HEIGHT;
            ensureSpace(LINE_HEIGHT);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          currentPage.drawText(currentLine, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: helvetica,
            color: rgb(0, 0, 0),
          });
          yPosition -= LINE_HEIGHT;
        }
        continue;
      }
      
      // Handle URLs line (contains http)
      if (line.includes('http')) {
        ensureSpace(LINE_HEIGHT);
        currentPage.drawText(line.length > 90 ? line.substring(0, 90) + '...' : line, {
          x: MARGIN,
          y: yPosition,
          size: 9,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
        yPosition -= LINE_HEIGHT;
        continue;
      }
      
      // Regular text - wrap if needed
      ensureSpace(LINE_HEIGHT);
      const words = line.split(' ');
      let currentLineText = '';
      const maxWidth = PAGE_WIDTH - MARGIN * 2;
      
      for (const word of words) {
        const testLine = currentLineText ? `${currentLineText} ${word}` : word;
        const testWidth = helvetica.widthOfTextAtSize(testLine, 10);
        
        if (testWidth > maxWidth && currentLineText) {
          currentPage.drawText(currentLineText, {
            x: MARGIN,
            y: yPosition,
            size: 10,
            font: helvetica,
            color: rgb(0, 0, 0),
          });
          yPosition -= LINE_HEIGHT;
          ensureSpace(LINE_HEIGHT);
          currentLineText = word;
        } else {
          currentLineText = testLine;
        }
      }
      if (currentLineText) {
        currentPage.drawText(currentLineText, {
          x: MARGIN,
          y: yPosition,
          size: 10,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
        yPosition -= LINE_HEIGHT;
      }
    }
    
    const pdfBytes = await pdfDoc.save();
    
    // Convert to base64
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    
    // Generate filename using [FirstName]_[LastName]_CV.pdf or [FirstName]_[LastName]_Cover_Letter.pdf format
    let finalFileName = fileName;
    if (!finalFileName) {
      // Use provided firstName/lastName, or extract from content
      let nameForFile = '';
      if (firstName && lastName) {
        nameForFile = `${firstName.trim()}_${lastName.trim()}`;
      } else {
        // Try to extract name from first line (usually uppercase name)
        const nameLine = lines.find(l => l === l.toUpperCase() && l.length < 50 && !l.includes('|') && !l.includes('@'));
        if (nameLine) {
          // Convert "JOHN DOE" to "John_Doe"
          nameForFile = nameLine.split(/\s+/).map(w => 
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join('_');
        } else {
          nameForFile = 'Applicant';
        }
      }
      // Sanitize filename - remove special chars
      nameForFile = nameForFile.replace(/[^a-zA-Z0-9_]/g, '');
      finalFileName = type === 'cv' ? `${nameForFile}_CV.pdf` : `${nameForFile}_Cover_Letter.pdf`;
    }
    
    console.log(`[generate-pdf] Generated ${finalFileName}, size: ${pdfBytes.length} bytes, location: ${tailoredLocation}`);
    
    return new Response(
      JSON.stringify({
        pdf: base64Pdf,
        fileName: finalFileName,
        location: tailoredLocation || 'Open to relocation',
        pages: pdfDoc.getPageCount()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-pdf] Raw content processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
