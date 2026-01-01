/**
 * ATS-Perfect PDF Generator
 * Creates recruiter-friendly PDFs with 1" margins, Helvetica font, and dynamic location
 */

(function() {
  'use strict';

  const PDFATSPerfect = {
    // PDF configuration for ATS compatibility
    CONFIG: {
      format: 'a4',
      unit: 'pt',
      margins: {
        top: 72,      // 1 inch = 72 points
        bottom: 72,
        left: 72,
        right: 72
      },
      fontSize: {
        header: 10,
        name: 14,
        sectionTitle: 11,
        body: 10,
        small: 9
      },
      lineHeight: 1.4,
      font: 'helvetica'
    },

    // A4 dimensions in points
    PAGE: {
      width: 595.28,
      height: 841.89
    },

    /**
     * Generate ATS-perfect CV PDF with dynamic location
     * @param {Object} jobData - Job information including location
     * @param {Object} candidateData - User profile data
     * @param {string} cvText - Tailored CV text content
     * @returns {Promise<Object>} PDF data and metadata
     */
    async generatePerfectCV(jobData, candidateData, cvText) {
      // Get tailored location from job data
      const tailoredLocation = window.LocationTailor 
        ? window.LocationTailor.extractFromJobData(jobData)
        : (jobData?.location || 'Open to relocation');

      console.log('[PDFATSPerfect] Generating PDF with location:', tailoredLocation);

      // Build the header
      const header = this.buildHeader(candidateData, tailoredLocation);

      // Parse CV sections
      const sections = this.parseCVSections(cvText);

      // Generate PDF using jsPDF if available, otherwise base64 text
      if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
        return this.generateWithJsPDF(header, sections, jobData, candidateData, tailoredLocation);
      } else {
        // Fallback: Generate formatted text for backend PDF generation
        return this.generateTextFormat(header, sections, jobData, candidateData, tailoredLocation);
      }
    },

    /**
     * Build the CV header with dynamic location
     * @param {Object} candidateData - User profile
     * @param {string} tailoredLocation - Normalized location
     * @returns {Object} Header lines and metadata
     */
    buildHeader(candidateData, tailoredLocation) {
      const firstName = candidateData.firstName || candidateData.first_name || 'Maxmilliam';
      const lastName = candidateData.lastName || candidateData.last_name || 'Okafor';
      const phone = candidateData.phone || '+353 0874261508';
      const email = candidateData.email || 'maxokafordev@gmail.com';
      const linkedin = candidateData.linkedin || 'https://www.linkedin.com/in/maxokafor/';
      const github = candidateData.github || 'https://github.com/MaxmilliamOkafor';
      const portfolio = candidateData.portfolio || 'https://maxmilliamplusplus.web.app/';

      return {
        name: `${firstName} ${lastName}`,
        contactLine: `${phone} | ${email} | ${tailoredLocation} | open to relocation`,
        linksLine: `${linkedin} | ${github} | ${portfolio}`,
        location: tailoredLocation
      };
    },

    /**
     * Parse CV text into structured sections
     * @param {string} cvText - Full CV text
     * @returns {Array} Array of section objects
     */
    parseCVSections(cvText) {
      if (!cvText) return [];

      const sections = [];
      const sectionHeaders = [
        'PROFESSIONAL SUMMARY',
        'EXPERIENCE',
        'WORK EXPERIENCE',
        'EDUCATION',
        'SKILLS',
        'TECHNICAL SKILLS',
        'CERTIFICATIONS',
        'ACHIEVEMENTS',
        'PROJECTS',
        'AWARDS'
      ];

      const lines = cvText.split('\n');
      let currentSection = { title: '', content: [] };

      for (const line of lines) {
        const trimmedLine = line.trim();
        const upperLine = trimmedLine.toUpperCase();

        // Check if this is a section header
        const isHeader = sectionHeaders.some(header => 
          upperLine === header || upperLine.startsWith(header + ':')
        );

        if (isHeader) {
          // Save previous section if it has content
          if (currentSection.title || currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { title: trimmedLine, content: [] };
        } else if (trimmedLine) {
          currentSection.content.push(trimmedLine);
        }
      }

      // Add last section
      if (currentSection.title || currentSection.content.length > 0) {
        sections.push(currentSection);
      }

      return sections;
    },

    /**
     * Generate PDF using jsPDF library
     * @returns {Promise<Object>} PDF blob and metadata
     */
    async generateWithJsPDF(header, sections, jobData, candidateData, tailoredLocation) {
      const { jsPDF } = jspdf;
      const doc = new jsPDF({
        format: 'a4',
        unit: 'pt',
        putOnlyUsedFonts: true
      });

      const { margins, fontSize, font } = this.CONFIG;
      const pageWidth = this.PAGE.width;
      const contentWidth = pageWidth - margins.left - margins.right;
      let yPos = margins.top;

      // Set ATS-friendly font
      doc.setFont(font, 'normal');

      // Name (centered, larger)
      doc.setFontSize(fontSize.name);
      doc.setFont(font, 'bold');
      const nameWidth = doc.getTextWidth(header.name);
      doc.text(header.name, (pageWidth - nameWidth) / 2, yPos);
      yPos += fontSize.name * 1.5;

      // Contact line (centered)
      doc.setFontSize(fontSize.header);
      doc.setFont(font, 'normal');
      const contactWidth = doc.getTextWidth(header.contactLine);
      if (contactWidth > contentWidth) {
        // Wrap if too long
        const lines = doc.splitTextToSize(header.contactLine, contentWidth);
        lines.forEach(line => {
          const lineWidth = doc.getTextWidth(line);
          doc.text(line, (pageWidth - lineWidth) / 2, yPos);
          yPos += fontSize.header * 1.3;
        });
      } else {
        doc.text(header.contactLine, (pageWidth - contactWidth) / 2, yPos);
        yPos += fontSize.header * 1.3;
      }

      // Links line (centered)
      const linksWidth = doc.getTextWidth(header.linksLine);
      if (linksWidth > contentWidth) {
        const lines = doc.splitTextToSize(header.linksLine, contentWidth);
        lines.forEach(line => {
          const lineWidth = doc.getTextWidth(line);
          doc.text(line, (pageWidth - lineWidth) / 2, yPos);
          yPos += fontSize.header * 1.3;
        });
      } else {
        doc.text(header.linksLine, (pageWidth - linksWidth) / 2, yPos);
        yPos += fontSize.header * 1.5;
      }

      // Add section separator
      yPos += 10;

      // Render each section
      for (const section of sections) {
        // Check if we need a new page
        if (yPos > this.PAGE.height - margins.bottom - 100) {
          doc.addPage();
          yPos = margins.top;
        }

        // Section title
        if (section.title) {
          doc.setFontSize(fontSize.sectionTitle);
          doc.setFont(font, 'bold');
          doc.text(section.title.toUpperCase(), margins.left, yPos);
          yPos += fontSize.sectionTitle + 5;

          // Underline
          doc.setDrawColor(0);
          doc.setLineWidth(0.5);
          doc.line(margins.left, yPos - 3, pageWidth - margins.right, yPos - 3);
          yPos += 8;
        }

        // Section content
        doc.setFontSize(fontSize.body);
        doc.setFont(font, 'normal');

        for (const line of section.content) {
          // Check for page break
          if (yPos > this.PAGE.height - margins.bottom - 20) {
            doc.addPage();
            yPos = margins.top;
          }

          // Handle bullet points
          const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
          const indent = isBullet ? 15 : 0;
          const text = isBullet ? line : line;

          // Wrap text to fit content width
          const wrappedLines = doc.splitTextToSize(text, contentWidth - indent);
          wrappedLines.forEach((wLine, idx) => {
            if (yPos > this.PAGE.height - margins.bottom - 20) {
              doc.addPage();
              yPos = margins.top;
            }
            doc.text(wLine, margins.left + (idx === 0 ? indent : indent), yPos);
            yPos += fontSize.body * this.CONFIG.lineHeight;
          });
        }

        yPos += 10; // Section spacing
      }

      // Generate filename
      const jobTitle = (jobData?.title || 'Position').replace(/[^a-zA-Z0-9]/g, '_');
      const locationClean = tailoredLocation.replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const firstName = candidateData.firstName || candidateData.first_name || 'Max';
      const lastName = candidateData.lastName || candidateData.last_name || 'Okafor';
      const fileName = `${firstName}_${lastName}_${jobTitle}_${locationClean}_${date}.pdf`;

      // Get PDF as base64
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const pdfBlob = doc.output('blob');

      return {
        pdf: pdfBase64,
        blob: pdfBlob,
        fileName: fileName,
        location: tailoredLocation,
        header: header
      };
    },

    /**
     * Generate text format for backend PDF generation
     * @returns {Object} Formatted text and metadata
     */
    generateTextFormat(header, sections, jobData, candidateData, tailoredLocation) {
      let fullText = '';

      // Header
      fullText += `${header.name}\n`;
      fullText += `${header.contactLine}\n`;
      fullText += `${header.linksLine}\n\n`;

      // Sections
      for (const section of sections) {
        if (section.title) {
          fullText += `${section.title.toUpperCase()}\n`;
          fullText += '─'.repeat(50) + '\n';
        }
        for (const line of section.content) {
          fullText += `${line}\n`;
        }
        fullText += '\n';
      }

      // Generate filename
      const jobTitle = (jobData?.title || 'Position').replace(/[^a-zA-Z0-9]/g, '_');
      const locationClean = tailoredLocation.replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const firstName = candidateData.firstName || candidateData.first_name || 'Max';
      const lastName = candidateData.lastName || candidateData.last_name || 'Okafor';
      const fileName = `${firstName}_${lastName}_${jobTitle}_${locationClean}_${date}.pdf`;

      return {
        text: fullText,
        fileName: fileName,
        location: tailoredLocation,
        header: header,
        sections: sections,
        // Flag for backend to generate actual PDF
        requiresBackendGeneration: true
      };
    },

    /**
     * Update existing CV text with new location in header
     * @param {string} cvText - Original CV text
     * @param {string} oldLocation - Location to replace
     * @param {string} newLocation - New tailored location
     * @returns {string} Updated CV text
     */
    updateLocationInCV(cvText, oldLocation, newLocation) {
      if (!cvText || !newLocation) return cvText;

      // Common patterns for location in CV header
      const patterns = [
        // Pattern: "| Dublin |" or "| Dublin,"
        new RegExp(`\\|\\s*${this.escapeRegex(oldLocation)}\\s*\\|`, 'gi'),
        // Pattern: ", Dublin |"
        new RegExp(`,\\s*${this.escapeRegex(oldLocation)}\\s*\\|`, 'gi'),
        // Pattern: "Dublin |" at start of line
        new RegExp(`^${this.escapeRegex(oldLocation)}\\s*\\|`, 'gmi'),
        // Pattern: "Location: Dublin"
        new RegExp(`Location:\\s*${this.escapeRegex(oldLocation)}`, 'gi')
      ];

      let updatedCV = cvText;
      for (const pattern of patterns) {
        updatedCV = updatedCV.replace(pattern, (match) => {
          return match.replace(oldLocation, newLocation);
        });
      }

      return updatedCV;
    },

    /**
     * Escape special regex characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Regenerate PDF after CV boost with updated content
     * @param {Object} params - Generation parameters
     * @returns {Promise<Object>} New PDF data
     */
    async regenerateAfterBoost(params) {
      const {
        jobData,
        candidateData,
        boostedCVText,
        currentLocation
      } = params;

      // Get the tailored location (may already be set or need extraction)
      const tailoredLocation = currentLocation || 
        (window.LocationTailor 
          ? window.LocationTailor.extractFromJobData(jobData)
          : jobData?.location || 'Open to relocation');

      console.log('[PDFATSPerfect] Regenerating PDF after boost with location:', tailoredLocation);

      return this.generatePerfectCV(
        { ...jobData, location: tailoredLocation },
        candidateData,
        boostedCVText
      );
    }
  };

  // Export to global scope
  window.PDFATSPerfect = PDFATSPerfect;
})();
