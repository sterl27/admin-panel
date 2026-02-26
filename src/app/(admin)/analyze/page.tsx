"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Music2,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Waves,
  Zap,
  Clock,
  Activity,
  BarChart3,
  Hash,
  Sparkles,
  Volume2,
  FileAudio,
  ChevronRight,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalysisResult {
  filename: string
  duration: number
  sr: number
  analysis: {
    tempo: number
    key: string
    dominant_chord: string
    harmonic_ratio: number
    beat_times: number[]
    spectral_centroid_avg: number
    mfcc_means: number[]
    pcen_energy: number
  }
  visualization: {
    mel_spectrogram_bins: number[]
    chroma_means: number[]
  }
  structure: {
    segments: { start: number; end: number; label: string }[]
    trim: { start_time: number; end_time: number; trimmed_duration: number }
  }
}

// ─── Note names for chroma display ──────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function formatHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz.toFixed(0)} Hz`
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "indigo",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
    fuchsia: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", border: "border-fuchsia-500/20" },
    sky: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  }
  const c = colors[accent] ?? colors.indigo
  return (
    <div className={`rounded-xl border ${c.border} bg-card/60 backdrop-blur-sm p-4 flex flex-col gap-2 hover:shadow-lg transition-shadow`}>
      <div className="flex items-center gap-2">
        <span className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function MelSpectrogram({ bins }: { bins: number[] }) {
  const max = Math.max(...bins)
  const min = Math.min(...bins)
  const range = max - min

  return (
    <div className="flex gap-px items-end h-24 w-full bg-slate-950/50 rounded-lg p-2 overflow-hidden group">
      {bins.map((val, i) => {
        const height = ((val - min) / (range || 1)) * 100
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-500 ease-out bg-gradient-to-t from-indigo-600 via-violet-500 to-fuchsia-400 group-hover:opacity-80"
            style={{ height: `${Math.max(2, height)}%` }}
          />
        )
      })}
    </div>
  )
}

function SegmentMap({ segments, totalDuration, onSeek }: { segments: any[], totalDuration: number, onSeek: (t: number) => void }) {
  const colors = [
    "bg-indigo-500/30 border-indigo-500/50",
    "bg-violet-500/30 border-violet-500/50",
    "bg-fuchsia-500/30 border-fuchsia-500/50",
    "bg-sky-500/30 border-sky-500/50",
    "bg-emerald-500/30 border-emerald-500/50",
    "bg-amber-500/30 border-amber-500/50"
  ]
  return (
    <div className="relative w-full h-10 flex gap-0.5 mt-2">
      {segments.map((s, i) => {
        const width = ((s.end - s.start) / totalDuration) * 100
        return (
          <div
            key={i}
            onClick={() => onSeek(s.start)}
            className={`h-full rounded border flex items-center justify-center cursor-pointer hover:brightness-125 transition-all overflow-hidden ${colors[i % colors.length]}`}
            style={{ width: `${width}%` }}
            title={`${s.label}: ${formatDuration(s.start)} - ${formatDuration(s.end)}`}
          >
            <span className="text-[10px] font-bold text-white/70 whitespace-nowrap px-1">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  // Effects state
  const [pitchShift, setPitchShift] = useState(0)
  const [timeStretch, setTimeStretch] = useState(1.0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Audio time tracking ──────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setAudioDuration(audio.duration)
    const onEnded = () => setIsPlaying(false)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("durationchange", onDurationChange)
    audio.addEventListener("ended", onEnded)
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("durationchange", onDurationChange)
      audio.removeEventListener("ended", onEnded)
    }
  }, [audioUrl])

  // ── File handling ────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setIsPlaying(false)
    setCurrentTime(0)
    const url = URL.createObjectURL(f)
    setAudioUrl(url)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFile(dropped)
    },
    [handleFile]
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ""
  }

  // ── Playback ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const onSeek = (t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  // ── Analysis ─────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file) return
    setIsAnalyzing(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || "Analysis failed")
      }
      const data = await res.json()
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis service unavailable")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── Effects Processing ───────────────────────────────────────────────────
  const applyEffects = async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`http://localhost:8000/process/effects?stretch=${timeStretch}&shift=${pitchShift}`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Processing failed")
      
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      
      // Update audio source
      setAudioUrl(url)
      setIsPlaying(false)
      setCurrentTime(0)
    } catch (err: unknown) {
      setError("Failed to process effects")
    } finally {
      setIsProcessing(false)
    }
  }

  const reset = () => {
    setFile(null)
    setAudioUrl(null)
    setResult(null)
    setError(null)
    setIsPlaying(false)
    setPitchShift(0)
    setTimeStretch(1.0)
    if (audioRef.current) audioRef.current.pause()
  }

  const currentSegment = result?.structure.segments.find(s => currentTime >= s.start && currentTime <= s.end)

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <Waves className="h-6 w-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Musaix Pro Intelligence
          </h1>
          <p className="text-muted-foreground text-sm">Powered by librosa · Advanced Audio Analysis & Neural Editing</p>
        </div>
      </div>

      {/* Upload zone */}
      {!file && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-3xl border-2 border-dashed p-20
            flex flex-col items-center justify-center gap-6 text-center
            transition-all duration-500 bg-card/30
            ${isDragging
              ? "border-indigo-500 bg-indigo-500/10 scale-[1.02] shadow-2xl shadow-indigo-500/20"
              : "border-border/50 hover:border-indigo-500/50 hover:bg-slate-900/40"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="audio/*"
            onChange={onInputChange}
          />
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center shadow-xl">
              <Upload className="h-10 w-10 text-indigo-300" />
            </div>
          </div>
          <div>
            <div className="font-bold text-2xl tracking-tight text-white/90">Initialize Audio Workspace</div>
            <div className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Drop professional stems or tracks to unlock AI-powered segmentation, key detection, and real-time DSP effects.
            </div>
          </div>
          <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:scale-105 transition-transform active:scale-95">
            <Plus className="h-4 w-4" />
            Pick Audio File
          </div>
        </div>
      )}

      {/* Split view: Controls & Visualization */}
      {file && audioUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Workspace (8 col) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Player Card */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-40 group-hover:opacity-100 transition-opacity">
                 <button onClick={reset} className="p-2 hover:bg-white/10 rounded-full"><RotateCcw className="w-4 h-4" /></button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center shadow-inner">
                  <Play className={`w-8 h-8 text-white ${isPlaying ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white/90 truncate max-w-sm">{file.name}</h3>
                  <p className="text-xs text-indigo-400 font-mono uppercase tracking-widest">{currentSegment?.label || "Workspace Active"}</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-2xl font-mono font-bold">{formatDuration(currentTime)}</div>
                  <div className="text-[10px] text-muted-foreground">/ {formatDuration(audioDuration)}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-4">
                <div className="relative group/seek">
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 1}
                    step={0.01}
                    value={currentTime}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    className="w-full h-2 rounded-full accent-fuchsia-500 bg-slate-800 cursor-pointer appearance-none outline-none"
                  />
                  {result && (
                     <div className="absolute -bottom-6 left-0 w-full flex justify-between pointer-events-none">
                        {result.structure.segments.map((s, i) => (
                           <div key={i} className="h-2 w-0.5 bg-white/20" style={{ marginLeft: `${(s.start/audioDuration)*100}%` }} />
                        ))}
                     </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={togglePlay}
                    className="h-12 w-12 rounded-full bg-white text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
                  >
                    {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                  </button>
                  
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="h-12 px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAnalyzing ? "Processing Neural Map..." : "Deep Analyze"}
                  </button>

                  <div className="ml-auto flex items-center gap-4">
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-tighter">
                      SR: {result?.sr || "Auto"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Neural Effects Engine */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h4 className="font-bold text-sm uppercase tracking-widest text-white/70">Neural Effects Layer</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Time Stretch */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground">TIME STRETCH</span>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{timeStretch.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range" min={0.5} max={2.0} step={0.05}
                    value={timeStretch} onChange={(e) => setTimeStretch(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50 font-mono">
                    <span>SLO-MO</span>
                    <span>NORMAL</span>
                    <span>FAST</span>
                  </div>
                </div>

                {/* Pitch Shift */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground">PITCH SHIFT (SEMITONES)</span>
                    <span className="text-xs font-mono text-fuchsia-400 font-bold">{pitchShift > 0 ? '+' : ''}{pitchShift}</span>
                  </div>
                  <input
                    type="range" min={-12} max={12} step={1}
                    value={pitchShift} onChange={(e) => setPitchShift(Number(e.target.value))}
                    className="w-full accent-fuchsia-500"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50 font-mono">
                    <span>-1 OCT</span>
                    <span>0</span>
                    <span>+1 OCT</span>
                  </div>
                </div>
              </div>

              <button
                onClick={applyEffects}
                disabled={isProcessing}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-bold hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Settings className="w-4 h-4" />}
                {isProcessing ? "Recalculating Waves..." : "Commit Effects & Re-Render"}
              </button>
            </div>
           
            {/* Segmentation & Structure */}
            {result && (
              <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 space-y-4">
                 <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm uppercase tracking-widest text-white/70">Song Structure Map</h4>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase font-bold tracking-tighter">librosa-segment v0.11</span>
                 </div>
                 <SegmentMap segments={result.structure.segments} totalDuration={result.duration} onSeek={onSeek} />
                 <p className="text-[10px] text-muted-foreground leading-relaxed mt-2 opacity-60 italic">
                    * Sections are automatically detected using agglomerative clustering on chroma features. Click any section to jump to its start point.
                 </p>
              </div>
            )}

          </div>

          {/* Visualization Sidebar (4 col) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Intelligence Overview */}
            {result ? (
              <>
                <div className="grid grid-cols-1 gap-4">
                  <StatCard 
                    icon={Music2} label="Harmonic Key" 
                    value={result.analysis.key} 
                    sub={`Dominant Chord: ${result.analysis.dominant_chord}`}
                    accent="fuchsia"
                  />
                  <StatCard 
                    icon={Zap} label="Tempo" 
                    value={`${result.analysis.tempo} BPM`} 
                    sub="Precision beat tracked"
                    accent="amber"
                  />
                  <StatCard 
                    icon={Activity} label="PCEN Energy" 
                    value={result.analysis.pcen_energy.toFixed(3)} 
                    sub="Normalized streaming gain"
                    accent="emerald"
                  />
                </div>

                {/* Mel Spectrogram */}
                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[10px] uppercase tracking-widest text-white/50">Spectral Profile (Mel)</h4>
                    <Volume2 className="w-3 h-3 text-white/30" />
                  </div>
                  <MelSpectrogram bins={result.visualization.mel_spectrogram_bins} />
                  <div className="flex justify-between text-[8px] text-muted-foreground font-mono uppercase">
                    <span>Low End</span>
                    <span>High Mids</span>
                    <span>Presence</span>
                  </div>
                </div>

                {/* Chroma Features */}
                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 space-y-4">
                   <h4 className="font-bold text-[10px] uppercase tracking-widest text-white/50">Pitch Class Energy (Chroma)</h4>
                   <div className="flex gap-px items-end h-16 w-full">
                      {result.visualization.chroma_means.map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                           <div 
                              className={`w-full rounded-t-sm transition-all duration-700 ${i === NOTE_NAMES.indexOf(result.analysis.key.replace('m','')) ? 'bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'bg-white/10'}`}
                              style={{ height: `${Math.max(4, v * 50)}px` }}
                           />
                           <span className="text-[7px] font-mono text-muted-foreground group-hover/bar:text-white transition-colors">{NOTE_NAMES[i]}</span>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Balance */}
                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 space-y-3">
                   <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase">
                      <span>Remix Balance</span>
                      <span>{(result.analysis.harmonic_ratio * 100).toFixed(0)}% Harmonic</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${result.analysis.harmonic_ratio * 100}%` }} />
                      <div className="h-full bg-rose-500 opacity-50" style={{ width: `${(1 - result.analysis.harmonic_ratio) * 100}%` }} />
                   </div>
                   <div className="flex justify-between text-[8px] text-muted-foreground/50 italic">
                      <span>Source separation active</span>
                   </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30">
                 <Loader2 className="w-8 h-8 mb-4 animate-[spin_3s_linear_infinite]" />
                 <p className="text-sm font-medium">Waiting for neural analysis...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-4 duration-300">
           <div className="bg-rose-500/20 border border-rose-500/50 backdrop-blur-xl p-4 rounded-xl flex items-center gap-3 text-rose-200 text-sm shadow-2xl shadow-rose-500/20">
              <div className="p-2 bg-rose-500 rounded-lg"><Zap className="w-4 h-4 text-white" /></div>
              <div>
                 <p className="font-bold">System Warning</p>
                 <p className="opacity-80">{error}</p>
              </div>
           </div>
        </div>
      )}

      {/* Processing global loader */}
      {(isAnalyzing || isProcessing) && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-[2px] cursor-wait" />
      )}
    </div>
  )
}

// ─── Missing Icons ──────────────────────────────────────────────────────────
function Plus(props: any) {
   return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
}

function Settings(props: any) {
   return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
}
