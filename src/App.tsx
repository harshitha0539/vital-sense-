import React, { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  Check,
  Bell,
  Volume2,
  Plus,
  Search,
  FileText,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Calendar,
} from 'lucide-react';
import {
  Biomarker,
  HealthReportAnalysis,
  MedicationAlertItem,
  SpecialistHospitalEntry,
} from './types';
import {
  SAMPLE_REPORTS,
  INITIAL_MEDICATIONS,
  SPECIALIST_HOSPITALS,
  patientAvatarUrl,
} from './data/initialData';

type ActiveSection = 'report' | 'protocol' | 'medications' | 'hospitals';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('report');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('metabolic_lipid');
  const [reportData, setReportData] = useState<HealthReportAnalysis>(
    SAMPLE_REPORTS.metabolic_lipid.data,
  );

  // Report filter & search state
  const [organFilter, setOrganFilter] = useState<string>('ALL');
  const [biomarkerSearch, setBiomarkerSearch] = useState<string>('');

  // Upload & Gemini AI Analysis state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [customReportText, setCustomReportText] = useState<string>(
    SAMPLE_REPORTS.metabolic_lipid.rawText,
  );
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [uploadedFileMime, setUploadedFileMime] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Diet & Exercise completion tracking
  const [completedMeals, setCompletedMeals] = useState<Record<string, boolean>>({
    'meal-1': true,
  });
  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({
    'ex-1': true,
  });

  // Medication Clock state
  const [medications, setMedications] = useState<MedicationAlertItem[]>(INITIAL_MEDICATIONS);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [soundAlertFeedback, setSoundAlertFeedback] = useState<string | null>(null);
  const [isAddMedOpen, setIsAddMedOpen] = useState<boolean>(false);
  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedDosage, setNewMedDosage] = useState<string>('');
  const [newMedTime, setNewMedTime] = useState<string>('14:00');
  const [newMedFoodRule, setNewMedFoodRule] = useState<string>('Take with water after meal');
  const [newMedBiomarker, setNewMedBiomarker] = useState<string>('General Preventive Protocol');

  // Hospitals & Specialist Cost Filter state
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('ALL');
  const [priceTierFilter, setPriceTierFilter] = useState<string>('ALL');
  const [maxConsultFee, setMaxConsultFee] = useState<number>(1200);
  const [selectedDoctorBooking, setSelectedDoctorBooking] =
    useState<SpecialistHospitalEntry | null>(null);
  const [bookingConfirmedId, setBookingConfirmedId] = useState<string | null>(null);
  const [bookingPatientNote, setBookingPatientNote] = useState<string>(
    'Attach HbA1c (6.1%), Fasting Insulin (13.8 uIU/mL) & Vitamin D3 (18.2 ng/mL) report for pre-visit review.',
  );

  // Live clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio synthesizer for gentle clinical medication alert chime
  const triggerClinicalChime = (label?: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Two-tone harmonic chime (C5 -> G5)
      const frequencies = [523.25, 783.99];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.16);
        gain.gain.setValueAtTime(0.001, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.16 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.16);
        osc.stop(now + idx * 0.16 + 0.6);
      });

      setSoundAlertFeedback(
        label || 'Clinical chime triggered · Next dose: Cholecalciferol D3 + K2 with breakfast lipids',
      );
      setTimeout(() => setSoundAlertFeedback(null), 4500);
    } catch {
      setSoundAlertFeedback('Visual alert active · Take scheduled dose with prescribed meal window');
      setTimeout(() => setSoundAlertFeedback(null), 4500);
    }
  };

  // Switch preset report
  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key);
    const preset = SAMPLE_REPORTS[key];
    if (preset) {
      setReportData(preset.data);
      setCustomReportText(preset.rawText);
      setAnalysisError(null);
    }
  };

  // Handle file upload for lab report
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileMime(file.type || 'image/png');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Clean = result.includes(',') ? result.split(',')[1] : result;
      setUploadedFileBase64(base64Clean);
    };
    reader.readAsDataURL(file);
  };

  // Analyze report via server-side Gemini endpoint
  const handleRunGeminiAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportText: customReportText,
          fileBase64: uploadedFileBase64,
          mimeType: uploadedFileMime,
          patientContext: 'Adult patient seeking root-cause diet, exercise, medication timing, and specialist care.',
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Could not parse diagnostic report.');
      }

      const updatedAnalysis: HealthReportAnalysis = {
        reportTitle: result.reportTitle || 'AI-Extracted Diagnostic Health Report',
        reportDate: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        patientName: 'Harshitha R.',
        labSource: uploadedFileName
          ? `Uploaded File · ${uploadedFileName}`
          : 'Direct Lab Text Extraction',
        summaryHeadline: result.summaryHeadline,
        conditionOverview: result.conditionOverview,
        recommendedSpecialistCategory: result.recommendedSpecialistCategory,
        biomarkers: result.biomarkers || [],
        dietPlan: result.dietPlan || [],
        exercisePlan: result.exercisePlan || [],
      };

      setReportData(updatedAnalysis);

      if (Array.isArray(result.suggestedMedications) && result.suggestedMedications.length > 0) {
        const mappedMeds: MedicationAlertItem[] = result.suggestedMedications.map(
          (m: Omit<MedicationAlertItem, 'id' | 'status'>, idx: number) => ({
            id: `ai-med-${idx + 1}`,
            name: m.name,
            dosage: m.dosage,
            scheduledTime: m.scheduledTime || '08:30',
            circadianWindow: m.circadianWindow || 'Morning',
            foodInstruction: m.foodInstruction,
            interactionWarning: m.interactionWarning,
            linkedBiomarker: m.linkedBiomarker,
            status: 'Scheduled',
          }),
        );
        setMedications(mappedMeds);
      }

      setIsUploadModalOpen(false);
      setActiveSection('report');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to analyze report right now.';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filtered biomarkers
  const filteredBiomarkers = useMemo(() => {
    return reportData.biomarkers.filter((bm) => {
      const matchesOrgan =
        organFilter === 'ALL'
          ? true
          : organFilter === 'FLAGGED'
            ? bm.status !== 'Normal'
            : bm.organSystem.toLowerCase().includes(organFilter.toLowerCase());
      const matchesQuery =
        !biomarkerSearch.trim() ||
        bm.name.toLowerCase().includes(biomarkerSearch.toLowerCase()) ||
        bm.clinicalInsight.toLowerCase().includes(biomarkerSearch.toLowerCase()) ||
        bm.organSystem.toLowerCase().includes(biomarkerSearch.toLowerCase());
      return matchesOrgan && matchesQuery;
    });
  }, [reportData.biomarkers, organFilter, biomarkerSearch]);

  // Summary counts
  const biomarkerStats = useMemo(() => {
    const total = reportData.biomarkers.length;
    const attention = reportData.biomarkers.filter((b) => b.status === 'Attention').length;
    const borderline = reportData.biomarkers.filter((b) => b.status === 'Borderline').length;
    const normal = reportData.biomarkers.filter((b) => b.status === 'Normal').length;
    return { total, attention, borderline, normal };
  }, [reportData.biomarkers]);

  // Filtered hospitals
  const filteredHospitals = useMemo(() => {
    return SPECIALIST_HOSPITALS.filter((h) => {
      const matchesSpec =
        specialtyFilter === 'ALL' ||
        h.specialty.toLowerCase().includes(specialtyFilter.toLowerCase());
      const matchesTier =
        priceTierFilter === 'ALL' || h.priceTier === priceTierFilter;
      const matchesPrice = h.consultationFee <= maxConsultFee;
      return matchesSpec && matchesTier && matchesPrice;
    });
  }, [specialtyFilter, priceTierFilter, maxConsultFee]);

  // Toggle medication status
  const handleToggleMedStatus = (id: string, nextStatus: 'Taken' | 'Snoozed' | 'Scheduled') => {
    const nowFormatted = currentTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setMedications((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: nextStatus,
              lastTakenAt: nextStatus === 'Taken' ? nowFormatted : m.lastTakenAt,
            }
          : m,
      ),
    );
  };

  // Add new medication alert
  const handleCreateMedAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    const hourNum = parseInt(newMedTime.split(':')[0] || '8', 10);
    const windowLabel =
      hourNum < 11 ? 'Morning' : hourNum < 16 ? 'Midday' : hourNum < 20 ? 'Evening' : 'Bedtime';

    const newEntry: MedicationAlertItem = {
      id: `custom-med-${Date.now()}`,
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || '1 Tablet',
      scheduledTime: newMedTime,
      circadianWindow: windowLabel,
      foodInstruction: newMedFoodRule.trim(),
      interactionWarning:
        'Verified spacing: Keep 2+ hours apart from high-dose calcium or iron chelators.',
      linkedBiomarker: newMedBiomarker.trim(),
      status: 'Scheduled',
    };
    setMedications((prev) => [...prev, newEntry]);
    setNewMedName('');
    setNewMedDosage('');
    setIsAddMedOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* TOP BAR CONTRACT: Strictly 3 zones (Brand wordmark | 4 Nav links | Primary Action) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 lg:px-10 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('report');
          }}
          className="text-2xl font-normal tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
        >
          Vitalsense
        </a>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveSection('report')}
            className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'report'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Report Intelligence
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('protocol')}
            className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'protocol'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Diet &amp; Exercise
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('medications')}
            className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'medications'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Medication Clock
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('hospitals')}
            className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'hospitals'
                ? 'border-teal-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Hospitals &amp; Pricing
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Health Report</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar (visible only on small screens) */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto bg-white border-b border-slate-200 px-4 py-2">
        {(
          [
            ['report', 'Report Lab'],
            ['protocol', 'Diet & Exercise'],
            ['medications', 'Med Alerts'],
            ['hospitals', 'Hospitals & Cost'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeSection === key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sound Alert Feedback Banner */}
      {soundAlertFeedback && (
        <div className="bg-teal-900 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-teal-300 shrink-0" />
            <span>{soundAlertFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setSoundAlertFeedback(null)}
            className="text-teal-200 hover:text-white text-xs underline whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Patient Context & Report Switcher Bar */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-6 lg:px-10 py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
              <img
                src={patientAvatarUrl}
                alt="Harshitha R. patient profile"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{reportData.patientName}</span>
                <span aria-hidden="true">·</span>
                <span>{reportData.reportDate}</span>
                <span aria-hidden="true">·</span>
                <span>{reportData.labSource}</span>
              </div>
              <h1
                className="text-2xl sm:text-3xl text-slate-900 mt-1 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                {reportData.summaryHeadline}
              </h1>
            </div>
          </div>

          {/* Preset Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {Object.entries(SAMPLE_REPORTS).map(([key]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedPresetKey === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {key === 'metabolic_lipid' ? 'Sample 1: Metabolic & Lipid' : 'Sample 2: Thyroid & Iron'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 lg:px-10 py-8 space-y-12">
        {/* =========================================================
            SECTION 1: HEALTH REPORT INTELLIGENCE & BIOMARKER TABLE
           ========================================================= */}
        {activeSection === 'report' && (
          <div className="space-y-10">
            {/* Root-Cause Clinical Synthesis Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 space-y-3">
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="font-semibold text-teal-800">01. Clinical Condition Synthesis</span>
                    <span aria-hidden="true">·</span>
                    <span>{reportData.reportTitle}</span>
                  </div>
                  <h2 className="text-2xl text-slate-900" style={{ textWrap: 'balance' }}>
                    How Your Out-of-Range Biomarkers Connect Physiologically
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-[72ch]">
                    {reportData.conditionOverview}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={() => setActiveSection('protocol')}
                      className="font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span>Open Biomarker-Matched Diet &amp; Exercise Plan</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('hospitals')}
                      className="font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <span>Compare {reportData.recommendedSpecialistCategory} Specialists &amp; Prices</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quantitative Summary Grid (Unboxed clean hairline layout) */}
                <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-8 grid grid-cols-2 gap-y-5 gap-x-6">
                  <div>
                    <div className="text-xs text-slate-500">Assayed Markers</div>
                    <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                      {biomarkerStats.total}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Verified reference ranges</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Requires Action</div>
                    <div className="text-2xl font-semibold font-mono tabular-nums text-red-600 mt-0.5">
                      {biomarkerStats.attention}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Priority repletion / control</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Borderline Drift</div>
                    <div className="text-2xl font-semibold font-mono tabular-nums text-amber-600 mt-0.5">
                      {biomarkerStats.borderline}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Reversible via diet &amp; Zone 2</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Optimal Baseline</div>
                    <div className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 mt-0.5">
                      {biomarkerStats.normal}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Within physiological target</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Filter Controls + Search + High-Density Biomarker Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Interactive Segmented Filter Controls */}
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
                  {[
                    { id: 'ALL', label: 'All Biomarkers' },
                    { id: 'FLAGGED', label: 'Out of Range Only' },
                    { id: 'Metabolic', label: 'Metabolic' },
                    { id: 'Cardiovascular', label: 'Cardiovascular' },
                    { id: 'Micronutrient', label: 'Micronutrients' },
                    { id: 'Thyroid', label: 'Thyroid & Hepatic' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOrganFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        organFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={biomarkerSearch}
                    onChange={(e) => setBiomarkerSearch(e.target.value)}
                    placeholder="Filter biomarker or mechanism..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              {/* Biomarker Data Grid */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                        <th className="py-3.5 px-5">Biomarker &amp; Organ System</th>
                        <th className="py-3.5 px-4 text-right">Assayed Value</th>
                        <th className="py-3.5 px-4 text-right">Reference Range</th>
                        <th className="py-3.5 px-4">Clinical Status</th>
                        <th className="py-3.5 px-5">Physiological Insight &amp; Direct Protocol Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredBiomarkers.map((bm: Biomarker) => (
                        <tr key={bm.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-5 align-top">
                            <div className="font-semibold text-slate-900">{bm.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              <span>{bm.organSystem}</span>
                              <span aria-hidden="true"> · </span>
                              <span>Lab Verified</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right align-top font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            {bm.value} <span className="text-xs font-normal text-slate-500">{bm.unit}</span>
                          </td>
                          <td className="py-4 px-4 text-right align-top font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                            {bm.referenceRange}
                          </td>
                          <td className="py-4 px-4 align-top whitespace-nowrap">
                            {bm.status === 'Attention' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Attention Required</span>
                              </span>
                            )}
                            {bm.status === 'Borderline' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Borderline Drift</span>
                              </span>
                            )}
                            {bm.status === 'Normal' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Optimal Range</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 align-top max-w-md">
                            <p className="text-xs text-slate-700 leading-relaxed">{bm.clinicalInsight}</p>
                            <p className="text-xs font-medium text-teal-800 mt-1.5">
                              Protocol: {bm.targetAction}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Bridge to All 4 Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-500">02. Chrono-Nutrition &amp; Movement</div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">
                    {reportData.dietPlan.length} Biomarker-Matched Meals &amp; {reportData.exercisePlan.length} Training Protocols
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Every dish and exercise session is calibrated to your assayed HbA1c, LDL-C, Vitamin D3, and Ferritin levels with explicit bioavailability rules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('protocol')}
                  className="mt-5 text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>View Daily Diet &amp; Exercise Prescription</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-500">03. Circadian Pill &amp; Supplement Clock</div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">
                    {medications.length} Timed Alerts with Absorption Conflict Guard
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Prevents iron-thyroid and calcium-iron chelation conflicts with automated 4-hour spacing rules and gentle Web Audio reminders.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('medications')}
                  className="mt-5 text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Medication Clock &amp; Alerts</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-500">04. Transparent Hospital &amp; Specialist Finder</div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-1">
                    Save up to 68% via Fair-Value &amp; Academic Medical Centers
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Compare verified consultation fees and repeat diagnostic bundles against regional corporate hospital averages before booking.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('hospitals')}
                  className="mt-5 text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Compare Specialists &amp; Reasonable Prices</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 2: BIOMARKER-LINKED DIET & EXERCISE PROTOCOL
           ========================================================= */}
        {activeSection === 'protocol' && (
          <div className="space-y-12">
            {/* Chrono-Nutrition Section */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="text-xs text-slate-500">
                    <span>01. Precision Chrono-Nutrition</span>
                    <span aria-hidden="true"> · </span>
                    <span>Calibrated to {reportData.reportTitle}</span>
                  </div>
                  <h2 className="text-3xl text-slate-900 mt-1" style={{ textWrap: 'balance' }}>
                    Biomarker-Matched Daily Meal Architecture
                  </h2>
                </div>
                <div className="text-xs text-slate-600 font-mono tabular-nums">
                  Completed Today:{' '}
                  <span className="font-semibold text-slate-900">
                    {Object.values(completedMeals).filter(Boolean).length} / {reportData.dietPlan.length} Meals
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl">
                {reportData.dietPlan.map((meal) => {
                  const isDone = !!completedMeals[meal.id];
                  return (
                    <div
                      key={meal.id}
                      className="p-6 lg:p-7 flex flex-col lg:flex-row lg:items-start justify-between gap-6"
                    >
                      <div className="space-y-2.5 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono tabular-nums font-semibold text-teal-800">
                            {meal.timeWindow}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">{meal.mealName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600">{meal.targetedBiomarkers}</span>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900">{meal.dishTitle}</h3>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-semibold text-slate-800">Measured Ingredients: </span>
                          {meal.ingredients}
                        </p>

                        <div className="text-xs text-slate-500 font-mono tabular-nums pt-0.5">
                          {meal.macros}
                        </div>

                        <div className="pt-2 text-xs text-teal-900 bg-teal-50/70 border-l-2 border-teal-700 pl-3 py-1.5">
                          <span className="font-semibold">Bioavailability &amp; Synergy Rule: </span>
                          {meal.bioavailabilityRule}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCompletedMeals((prev) => ({ ...prev, [meal.id]: !prev[meal.id] }))
                          }
                          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                            isDone
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isDone ? 'Logged in Daily Intake' : 'Mark Meal Completed'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exercise & Myokine Prescription Section */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="text-xs text-slate-500">
                    <span>02. Physiological Movement Prescription</span>
                    <span aria-hidden="true"> · </span>
                    <span>Heart-Rate &amp; Ferritin Guardrails Applied</span>
                  </div>
                  <h2 className="text-3xl text-slate-900 mt-1" style={{ textWrap: 'balance' }}>
                    Targeted Exercise &amp; Glycemic Disposal Sessions
                  </h2>
                </div>
                <div className="text-xs text-slate-600 font-mono tabular-nums">
                  Logged Sessions:{' '}
                  <span className="font-semibold text-slate-900">
                    {Object.values(completedExercises).filter(Boolean).length} /{' '}
                    {reportData.exercisePlan.length} Active
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl">
                {reportData.exercisePlan.map((ex) => {
                  const isDone = !!completedExercises[ex.id];
                  return (
                    <div
                      key={ex.id}
                      className="p-6 lg:p-7 flex flex-col lg:flex-row lg:items-start justify-between gap-6"
                    >
                      <div className="space-y-2.5 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{ex.cadence}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{ex.durationMinutes} mins</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-teal-800 font-medium">
                            {ex.heartRateZone}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900">{ex.sessionTitle}</h3>

                        <p className="text-xs text-slate-700 leading-relaxed">
                          <span className="font-semibold text-slate-900">Biomarker Mechanism: </span>
                          {ex.targetedBiomarkerMechanism}
                        </p>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-semibold text-slate-800">Execution Protocol: </span>
                          {ex.protocolSteps}
                        </p>

                        <div className="pt-1 text-xs text-amber-800">
                          <span className="font-semibold">Clinical Safety Guardrail: </span>
                          {ex.safetyGuardrail}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setCompletedExercises((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
                          }
                          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                            isDone
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isDone ? 'Session Completed' : 'Log Workout Session'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 3: CIRCADIAN MEDICATION & SUPPLEMENT ALERT CLOCK
           ========================================================= */}
        {activeSection === 'medications' && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-teal-700" />
                  <span>Circadian Pharmacokinetic Schedule</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    Local Time:{' '}
                    {currentTime.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <h2 className="text-3xl text-slate-900" style={{ textWrap: 'balance' }}>
                  Timed Medication &amp; Supplement Alerts with Absorption Guard
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Taking iron, calcium, or coffee at the wrong hour can reduce thyroid hormone or micronutrient absorption by up to 50%. Your schedule automatically separates conflicting compounds across 4 biological windows.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    triggerClinicalChime(
                      'Medication Chime Alert Tested · Next scheduled dose: Cholecalciferol D3 2000 IU with breakfast',
                    )
                  }
                  className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-teal-700" />
                  <span>Test Audio Alert Chime</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMedOpen((prev) => !prev)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Medicine Alert</span>
                </button>
              </div>
            </div>

            {/* Add New Medication Form */}
            {isAddMedOpen && (
              <form
                onSubmit={handleCreateMedAlert}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Add New Prescription or Biomarker Supplement Alert
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddMedOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Medicine / Supplement Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newMedName}
                      onChange={(e) => setNewMedName(e.target.value)}
                      placeholder="e.g., Rosuvastatin / B12"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Dosage</label>
                    <input
                      type="text"
                      value={newMedDosage}
                      onChange={(e) => setNewMedDosage(e.target.value)}
                      placeholder="e.g., 5 mg Tablet"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Alert Time (24h)
                    </label>
                    <input
                      type="time"
                      value={newMedTime}
                      onChange={(e) => setNewMedTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Food / Timing Instruction
                    </label>
                    <input
                      type="text"
                      value={newMedFoodRule}
                      onChange={(e) => setNewMedFoodRule(e.target.value)}
                      placeholder="e.g., 30 mins before dinner"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Targeted Biomarker
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMedBiomarker}
                        onChange={(e) => setNewMedBiomarker(e.target.value)}
                        placeholder="e.g., LDL-C (144 mg/dL)"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Medication Schedule Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-3.5 px-5">Scheduled Time</th>
                      <th className="py-3.5 px-4">Medication / Supplement &amp; Dosage</th>
                      <th className="py-3.5 px-4">Food &amp; Interaction Guardrail</th>
                      <th className="py-3.5 px-4">Adherence Status</th>
                      <th className="py-3.5 px-5 text-right">Alert Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {medications.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5 align-top whitespace-nowrap">
                          <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                            {med.scheduledTime}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{med.circadianWindow} Window</div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-semibold text-slate-900">{med.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            <span>{med.dosage}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-sans text-teal-800">{med.linkedBiomarker}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top max-w-md">
                          <div className="text-xs font-medium text-slate-800">{med.foodInstruction}</div>
                          <div className="text-xs text-slate-500 mt-1">{med.interactionWarning}</div>
                        </td>
                        <td className="py-4 px-4 align-top whitespace-nowrap">
                          {med.status === 'Taken' && (
                            <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Taken {med.lastTakenAt ? `at ${med.lastTakenAt}` : ''}</span>
                            </div>
                          )}
                          {med.status === 'Snoozed' && (
                            <div className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Snoozed (+15m)</span>
                            </div>
                          )}
                          {med.status === 'Scheduled' && (
                            <div className="text-xs font-medium text-slate-600">
                              Scheduled · Alert Armed
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleMedStatus(med.id, 'Taken')}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                med.status === 'Taken'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-teal-700 text-white hover:bg-teal-800'
                              }`}
                            >
                              {med.status === 'Taken' ? 'Taken' : 'Mark Taken'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleToggleMedStatus(med.id, 'Snoozed');
                                triggerClinicalChime(`Snoozed ${med.name} reminder by 15 minutes`);
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            >
                              Snooze 15m
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 4: TRANSPARENT HOSPITALS, SPECIALISTS & FAIR PRICES
           ========================================================= */}
        {activeSection === 'hospitals' && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="text-xs text-slate-500">
                    <span>Biomarker-Matched Specialist Network</span>
                    <span aria-hidden="true"> · </span>
                    <span>Recommended Focus: {reportData.recommendedSpecialistCategory}</span>
                  </div>
                  <h2 className="text-3xl text-slate-900" style={{ textWrap: 'balance' }}>
                    Accredited Hospitals, Specialist Doctors &amp; Reasonable Price Benchmarks
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every hospital listing below compares consultation fees and repeat diagnostic lab bundles against the regional private hospital average, highlighting JCI/NABH accredited institutions and non-profit academic centers with upfront tariff guarantees.
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Specialty Filter</label>
                    <select
                      value={specialtyFilter}
                      onChange={(e) => setSpecialtyFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    >
                      <option value="ALL">All Matched Specialties</option>
                      <option value="Endocrinology">Endocrinology &amp; Metabolic</option>
                      <option value="Cardiology">Preventive Cardiology</option>
                      <option value="Internal Medicine">Internal Medicine &amp; Hematology</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pricing Tier</label>
                    <select
                      value={priceTierFilter}
                      onChange={(e) => setPriceTierFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    >
                      <option value="ALL">All Price Tiers</option>
                      <option value="Subsidized Academic">Subsidized Academic</option>
                      <option value="Fair Value Benchmark">Fair Value Benchmark</option>
                      <option value="Standard Private">Standard Private</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-mono tabular-nums">
                      Max Consultation Fee: ₹{maxConsultFee}
                    </label>
                    <input
                      type="range"
                      min={450}
                      max={1500}
                      step={50}
                      value={maxConsultFee}
                      onChange={(e) => setMaxConsultFee(Number(e.target.value))}
                      className="w-36 accent-teal-700 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Specialist & Hospital Comparison List */}
            <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl">
              {filteredHospitals.map((item) => {
                const consultSavingsPct = Math.round(
                  ((item.regionalAverageFee - item.consultationFee) / item.regionalAverageFee) * 100,
                );
                const bundleSavingsPct = Math.round(
                  ((item.regionalDiagnosticAverage - item.diagnosticBundlePrice) /
                    item.regionalDiagnosticAverage) *
                    100,
                );

                return (
                  <div
                    key={item.id}
                    className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                  >
                    {/* Left Column: Specialist & Hospital Details */}
                    <div className="lg:col-span-7 flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center text-sm font-semibold text-teal-900">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={item.doctorName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>
                            {item.doctorName
                              .replace('Dr. ', '')
                              .split(' ')
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-teal-800">{item.specialty}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{item.experienceYears} yrs clinical exp</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.priceTier}</span>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900">{item.doctorName}</h3>

                        <div className="text-xs font-medium text-slate-800">
                          {item.hospitalName} · <span className="font-normal text-slate-500">{item.cityDistrict}</span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed pt-1">
                          <span className="font-semibold text-slate-800">Clinical Focus: </span>
                          {item.subSpecialtyFocus}
                        </p>

                        <p className="text-xs text-slate-500">
                          <span className="font-medium text-slate-700">Matched to Your Report: </span>
                          {item.matchedBiomarkers.join(' · ')}
                        </p>

                        <p className="text-xs text-emerald-800 pt-1">
                          Verified Outcome: {item.outcomesMetric}
                        </p>
                      </div>
                    </div>

                    {/* Right Column: Transparent Cost Benchmark & Booking */}
                    <div className="lg:col-span-5 lg:border-l border-slate-200 lg:pl-8 flex flex-col justify-between gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-500">Specialist Consultation</div>
                          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                            ₹{item.consultationFee}{' '}
                            <span className="text-xs font-normal line-through text-slate-400">
                              ₹{item.regionalAverageFee}
                            </span>
                          </div>
                          <div className="text-xs text-emerald-700 font-medium mt-0.5">
                            {consultSavingsPct}% below city average
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500">Follow-up Lab Bundle</div>
                          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                            ₹{item.diagnosticBundlePrice}{' '}
                            <span className="text-xs font-normal line-through text-slate-400">
                              ₹{item.regionalDiagnosticAverage}
                            </span>
                          </div>
                          <div className="text-xs text-emerald-700 font-medium mt-0.5">
                            Saves ₹{item.regionalDiagnosticAverage - item.diagnosticBundlePrice} ({bundleSavingsPct}%)
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                        <div className="text-xs text-slate-500">
                          <span className="font-medium text-slate-700">Next Slot: </span>
                          <span className="font-mono tabular-nums">{item.nextAvailableSlot}</span>
                        </div>

                        {bookingConfirmedId === item.id ? (
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Tariff Locked &amp; Requested</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedDoctorBooking(item)}
                            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Lock Price &amp; Book
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          MODAL 1: UPLOAD & AI ANALYZE HEALTH REPORT
         ========================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 lg:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-teal-800 font-semibold">
                  Multimodal Clinical Lab Parser
                </div>
                <h2 className="text-2xl text-slate-900 mt-0.5">
                  Upload Health Report Image or Paste Lab Values
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRunGeminiAnalysis} className="space-y-5">
              {/* File Input Dropzone */}
              <div className="border border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-teal-700 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {uploadedFileName
                        ? `Attached: ${uploadedFileName}`
                        : 'Attach Blood Report Photo or Diagnostic PDF'}
                    </div>
                    <div className="text-xs text-slate-500">
                      Supports PNG, JPG, WebP, or PDF up to 10MB
                    </div>
                  </div>
                </div>
                <label className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                  <span>Choose Report File</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Raw Lab Text Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Lab Biomarker Values / Clinical Notes
                  </label>
                  <span className="text-xs text-slate-500">
                    Edit values below to test live AI protocol generation
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={customReportText}
                  onChange={(e) => setCustomReportText(e.target.value)}
                  placeholder="Paste your blood test values (e.g. HbA1c, Vitamin D, LDL, TSH, Ferritin, Creatinine)..."
                  className="w-full p-3.5 text-xs font-mono bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              {analysisError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {analysisError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Biomarkers &amp; Generating Diet/Exercise Plan...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Analyze Report &amp; Build Personal Protocol</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: PRICE-LOCKED HOSPITAL CONSULTATION BOOKING
         ========================================================= */}
      {selectedDoctorBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 lg:p-8 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-teal-800 font-semibold">
                  Transparent Tariff Guarantee · {selectedDoctorBooking.priceTier}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mt-0.5">
                  {selectedDoctorBooking.doctorName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDoctorBooking.hospitalName} · {selectedDoctorBooking.cityDistrict}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoctorBooking(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-y border-slate-200 py-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Locked Consultation Fee</span>
                <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                  ₹{selectedDoctorBooking.consultationFee}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Appointment Window</span>
                <div className="text-sm font-semibold font-mono tabular-nums text-teal-800 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedDoctorBooking.nextAvailableSlot}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pre-Visit Biomarker Summary Sent to Doctor
              </label>
              <textarea
                rows={3}
                value={bookingPatientNote}
                onChange={(e) => setBookingPatientNote(e.target.value)}
                className="w-full p-3 text-xs border border-slate-200 rounded-lg text-slate-700"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedDoctorBooking(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingConfirmedId(selectedDoctorBooking.id);
                  setSelectedDoctorBooking(null);
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                Confirm Price-Locked Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiet Clinical Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-[1360px] mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Vitalsense Clinical Intelligence · Decision-support biomarker synthesis &amp; transparent hospital tariff benchmarks.
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveSection('hospitals')}
              className="hover:text-slate-900 underline cursor-pointer"
            >
              Compare Hospital Tariffs
            </button>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="hover:text-slate-900 underline cursor-pointer"
            >
              Upload New Lab Report
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
