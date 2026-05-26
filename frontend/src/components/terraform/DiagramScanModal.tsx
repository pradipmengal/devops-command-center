import { useState, useRef, useCallback } from 'react';
import {
  Upload, X, FileImage, FileCode2, Scan, CheckCircle2,
  AlertTriangle, ChevronRight, Loader2, Sparkles, Download,
  Copy, Check, Info, FileText,
} from 'lucide-react';
import { scanDiagram, generateTerraformFromDetected } from '../../utils/diagramScanner';
import useTerraformStore from '../../store/useTerraformStore';

const CONFIDENCE_STYLE = {
  high:   { label: 'High',   color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)'  },
  medium: { label: 'Medium', color: '#facc15', bg: 'rgba(250,204,21,0.1)',  border: 'rgba(250,204,21,0.3)'  },
  low:    { label: 'Low',    color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
};

const PROVIDER_META = {
  aws:     { label: 'Amazon Web Services', icon: '🟠', color: '#fb923c' },
  azure:   { label: 'Microsoft Azure',     icon: '🔵', color: '#60a5fa' },
  gcp:     { label: 'Google Cloud',        icon: '🔴', color: '#f87171' },
  unknown: { label: 'Unknown Provider',    icon: '❓', color: '#94a3b8' },
};

export default function DiagramScanModal({ onClose }) {
  const { providerRegion } = useTerraformStore();

  const [step, setStep] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [generatedTf, setGeneratedTf] = useState('');
  const [selectedResources, setSelectedResources] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [_scanPhase, setScanPhase] = useState('');
  const [_showExtractedText, _setShowExtractedText] = useState(false);

  const fileInputRef = useRef(null);

  const processFile = useCallback(async (file) => {
    setError('');
    setStep('scanning');

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      setScanPhase('Running OCR on image…');
    } else if (ext === 'pdf') {
      setScanPhase('Extracting text from PDF…');
    } else {
      setScanPhase('Parsing Draw.io shapes…');
    }

    try {
      const result = await scanDiagram(file);
      setScanPhase('Mapping resources to Terraform…');
      setScanResult(result);
      setSelectedResources(new Set(result.resources.map((r) => r.id)));
      const tf = generateTerraformFromDetected(result.resources, result.provider, providerRegion);
      setGeneratedTf(tf);
      setStep('results');
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
      setStep('upload');
    }
  }, [providerRegion]);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const regenerateTf = (selected) => {
    if (!scanResult) return;
    const filtered = scanResult.resources.filter((r) => selected.has(r.id));
    const tf = generateTerraformFromDetected(filtered, scanResult.provider, providerRegion);
    setGeneratedTf(tf);
  };

  const handleToggle = (id) => {
    const next = new Set(selectedResources);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedResources(next);
    regenerateTf(next);
  };

  const handleSelectAll = () => {
    if (!scanResult) return;
    const all = new Set(scanResult.resources.map((r) => r.id));
    setSelectedResources(all);
    regenerateTf(all);
  };

  const handleSelectNone = () => {
    setSelectedResources(new Set());
    regenerateTf(new Set());
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedTf);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedTf], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-scan-${scanResult?.provider ?? 'terraform'}.tf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = selectedResources.size;
  const pm = PROVIDER_META[scanResult?.provider ?? 'unknown'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden fade-in"
        style={{
          background: 'linear-gradient(180deg, rgba(13,19,33,0.99) 0%, rgba(8,12,20,0.99) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 0 80px rgba(99,102,241,0.15), 0 32px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, #6366f1, #38bdf8, #34d399)' }} />

        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(56,189,248,0.2))',
                border: '1px solid rgba(99,102,241,0.4)',
                boxShadow: '0 0 16px rgba(99,102,241,0.2)',
              }}>
              <Scan size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                Architecture Diagram Scanner
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
                Upload PNG, JPEG or Draw.io — get Terraform instantly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-8">
            {(['upload', 'scanning', 'results']).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={step === s ? {
                    background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                    color: 'white',
                    boxShadow: '0 0 12px rgba(99,102,241,0.5)',
                  } : (
                    (s === 'results' && step !== 'results') || (s === 'scanning' && step === 'upload')
                  ) ? {
                    background: 'rgba(255,255,255,0.06)',
                    color: '#475569',
                  } : {
                    background: 'rgba(99,102,241,0.2)',
                    color: '#818cf8',
                  }}
                >
                  {i + 1}
                </div>
                <span className="text-[10px] capitalize hidden sm:block"
                  style={{ color: step === s ? '#a5b4fc' : '#475569' }}>
                  {s}
                </span>
                {i < 2 && <ChevronRight size={12} className="text-gray-700" />}
              </div>
            ))}
          </div>

          <button onClick={onClose}
            className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">

          {step === 'upload' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-xl cursor-pointer rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-4 py-14 px-8"
                style={{
                  background: dragOver
                    ? 'rgba(99,102,241,0.12)'
                    : 'rgba(255,255,255,0.02)',
                  border: dragOver
                    ? '2px dashed rgba(99,102,241,0.7)'
                    : '2px dashed rgba(255,255,255,0.1)',
                  boxShadow: dragOver ? '0 0 40px rgba(99,102,241,0.15)' : 'none',
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: dragOver
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(56,189,248,0.2))'
                      : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    boxShadow: dragOver ? '0 0 24px rgba(99,102,241,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <Upload size={28} className={dragOver ? 'text-indigo-400' : 'text-gray-600'} />
                </div>

                <div className="text-center">
                  <p className="text-white font-semibold text-base mb-1">
                    {dragOver ? 'Drop your diagram here' : 'Upload Architecture Diagram'}
                  </p>
                  <p className="text-[12px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    Drag & drop or click to browse
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {[
                    { icon: <FileImage size={13} />, label: 'PNG',     color: '#34d399', desc: 'OCR scan' },
                    { icon: <FileImage size={13} />, label: 'JPEG',    color: '#38bdf8', desc: 'OCR scan' },
                    { icon: <FileText  size={13} />, label: 'PDF',     color: '#f59e0b', desc: 'Text extract' },
                    { icon: <FileCode2 size={13} />, label: 'Draw.io', color: '#a78bfa', desc: 'Shape parse' },
                  ].map((fmt) => (
                    <div key={fmt.label}
                      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[11px] font-medium"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: fmt.color,
                        minWidth: 72,
                      }}>
                      <div className="flex items-center gap-1">{fmt.icon} {fmt.label}</div>
                      <span className="text-[9px]" style={{ color: 'rgba(148,163,184,0.5)' }}>{fmt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.drawio,.xml,.pdf"
                className="hidden"
                onChange={handleFileInput}
              />

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="w-full max-w-xl rounded-xl p-4"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Info size={13} className="text-indigo-400" />
                  <span className="text-[11px] font-semibold text-indigo-300">Tips for best results</span>
                </div>
                <ul className="space-y-1">
                  {[
                    'Draw.io files give the highest accuracy — shapes are parsed directly',
                    'Label each shape with the service name (e.g. "EC2", "RDS", "S3 Bucket")',
                    'For images, include service names in the filename (e.g. aws-web-app.png)',
                    'Supports AWS, Azure, and GCP architectures',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]"
                      style={{ color: 'rgba(148,163,184,0.7)' }}>
                      <span className="text-indigo-500 mt-0.5 flex-shrink-0">✦</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(56,189,248,0.1))',
                    border: '1px solid rgba(99,102,241,0.3)',
                    boxShadow: '0 0 40px rgba(99,102,241,0.2)',
                  }}
                >
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-lg mb-1">Scanning diagram…</p>
                <p className="text-[12px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  Detecting cloud resources and mapping to Terraform
                </p>
              </div>
              <div className="flex gap-2">
                {['Parsing shapes', 'Detecting services', 'Generating HCL'].map((label, i) => (
                  <div key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px]"
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      color: '#a5b4fc',
                    }}>
                    <Loader2 size={10} className="animate-spin" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'results' && scanResult && (
            <div className="flex-1 overflow-hidden flex">

              <div className="w-80 flex-shrink-0 flex flex-col border-r"
                style={{ borderRightColor: 'rgba(255,255,255,0.07)' }}>

                <div className="px-4 py-3 border-b"
                  style={{ borderBottomColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{pm.icon}</span>
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: pm.color }}>{pm.label}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                        {scanResult.fileType === 'drawio' ? '📐 Draw.io' : '🖼 Image'} · {scanResult.fileName}
                      </p>
                    </div>
                  </div>

                  {scanResult.warnings.length > 0 && (
                    <div className="rounded-lg p-2 mt-2"
                      style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }}>
                      {scanResult.warnings.map((w, i) => (
                        <p key={i} className="text-[10px] leading-relaxed" style={{ color: '#fde68a' }}>
                          ⚠ {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-4 py-2 border-b"
                  style={{ borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {selectedCount} / {scanResult.resources.length} selected
                  </span>
                  <div className="flex gap-1">
                    <button onClick={handleSelectAll}
                      className="text-[9px] px-2 py-0.5 rounded transition-all"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                      All
                    </button>
                    <button onClick={handleSelectNone}
                      className="text-[9px] px-2 py-0.5 rounded transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                      None
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {scanResult.resources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <span className="text-2xl opacity-30">🔍</span>
                      <p className="text-[11px] text-gray-600 text-center">
                        No resources detected.<br />Try a Draw.io file with labelled shapes.
                      </p>
                    </div>
                  ) : (
                    scanResult.resources.map((res) => {
                      const cs = CONFIDENCE_STYLE[res.confidence];
                      const isSelected = selectedResources.has(res.id);
                      return (
                        <div
                          key={res.id}
                          onClick={() => handleToggle(res.id)}
                          className="rounded-xl p-3 cursor-pointer transition-all"
                          style={{
                            background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                            border: isSelected
                              ? '1px solid rgba(99,102,241,0.4)'
                              : '1px solid rgba(255,255,255,0.07)',
                            boxShadow: isSelected ? '0 0 12px rgba(99,102,241,0.1)' : 'none',
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                              style={isSelected ? {
                                background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                                border: '1px solid #6366f1',
                              } : {
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.15)',
                              }}
                            >
                              {isSelected && <CheckCircle2 size={10} className="text-white" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-gray-200 truncate">
                                {res.label}
                              </p>
                              <p className="text-[9px] font-mono mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.5)' }}>
                                {res.terraformType}
                              </p>
                            </div>

                            <span
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}
                            >
                              {cs.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-3 border-t" style={{ borderTopColor: 'rgba(255,255,255,0.07)' }}>
                  <button
                    onClick={() => { setStep('upload'); setScanResult(null); setGeneratedTf(''); }}
                    className="w-full text-[11px] py-2 rounded-xl transition-all font-medium"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#64748b',
                    }}
                  >
                    ← Scan another diagram
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b"
                  style={{ borderBottomColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-indigo-400" />
                    <span className="text-[12px] font-semibold text-gray-300">
                      Generated Terraform
                    </span>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                    >
                      {selectedCount} resource{selectedCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
                    >
                      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        border: '1px solid rgba(99,102,241,0.5)',
                        color: 'white',
                        boxShadow: '0 0 12px rgba(99,102,241,0.3)',
                      }}
                    >
                      <Download size={11} />
                      Download .tf
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  <pre
                    className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words"
                    style={{ color: '#e2e8f0' }}
                  >
                    {generatedTf || '# Select resources on the left to generate Terraform code'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
