import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import init, { evaluate_profile, evaluate_cam_contour, evaluate_linear_cam_contour, evaluate_dynamics } from 'motus_wasm';
import type { MotionPoint, ChartLayout, SegmentBoundary } from '../components/KinematicChart';
import type { CamContourData, LinearCamContourData, CamDisplayType } from '../components/CamContourChart';
import type { SegmentDef } from '../components/SegmentEditor';
import type { Project } from '../api';
import type { UnitSystem } from '../units';
import { DEFAULT_UNITS, convertLength, convertAngle, lengthToInternal } from '../units';
import { useHistory } from '../hooks/useHistory';
import type { HistoryState } from '../hooks/useHistory';
import type { Locale } from '../i18n';
import type { Theme } from '../theme';
import { applyTheme } from '../theme';

// Default composed profile
export const DEFAULT_SEGMENTS: SegmentDef[] = [
  {
    id: crypto.randomUUID(), name: "Rise", law: "Cycloidal",
    phi_start: 0, phi_end: 120, stroke: 50, s_start: 0,
    boundary_conditions: {
      start_velocity: { Fixed: 0.0 }, end_velocity: { Fixed: 0.0 },
      start_acceleration: { Fixed: 0.0 }, end_acceleration: { Fixed: 0.0 },
      start_jerk: "Free", end_jerk: "Free",
    },
    color: '#3b82f6', metadata: {}
  },
  {
    id: crypto.randomUUID(), name: "Dwell", law: "Dwell",
    phi_start: 120, phi_end: 180, stroke: 0, s_start: 50,
    boundary_conditions: {
      start_velocity: { Fixed: 0.0 }, end_velocity: { Fixed: 0.0 },
      start_acceleration: { Fixed: 0.0 }, end_acceleration: { Fixed: 0.0 },
      start_jerk: "Free", end_jerk: "Free",
    },
    color: '#10b981', metadata: {}
  },
  {
    id: crypto.randomUUID(), name: "Return", law: "Polynomial345",
    phi_start: 180, phi_end: 360, stroke: -50, s_start: 50,
    boundary_conditions: {
      start_velocity: { Fixed: 0.0 }, end_velocity: { Fixed: 0.0 },
      start_acceleration: { Fixed: 0.0 }, end_acceleration: { Fixed: 0.0 },
      start_jerk: "Free", end_jerk: "Free",
    },
    color: '#f59e0b', metadata: {}
  },
];

export function buildWasmProfile(segments: SegmentDef[], units: UnitSystem) {
  const wasmSegments = segments.map(seg => {
    let law: any = seg.law;
    if (seg.law === 'Bezier') {
      law = {
        Bezier: {
          cx1: seg.bezier_cx1 ?? 0.25, cy1: seg.bezier_cy1 ?? 0.1,
          cx2: seg.bezier_cx2 ?? 0.25, cy2: seg.bezier_cy2 ?? 1.0,
        }
      };
    } else if (seg.law === 'NumericSpline') {
      law = {
        NumericSpline: {
          points: seg.numeric_points || [[0.0, 0.0], [1.0, 1.0]]
        }
      };
    }
    const phi_start = units.angle === 'rad' ? convertAngle(seg.phi_start, 'rad', 'deg') : seg.phi_start;
    const phi_end = units.angle === 'rad' ? convertAngle(seg.phi_end, 'rad', 'deg') : seg.phi_end;
    const stroke = lengthToInternal(seg.stroke, units.length);
    const s_start = lengthToInternal(seg.s_start, units.length);

    return {
      ...seg, phi_start, phi_end, stroke, s_start, law,
      name: seg.name || null, color: null,
      bezier_cx1: undefined, bezier_cy1: undefined, bezier_cx2: undefined, bezier_cy2: undefined,
      numeric_points: undefined,
    };
  });

  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Interactive Profile",
    segments: wasmSegments,
    total_stroke: Math.max(...wasmSegments.map(s => s.s_start + Math.abs(s.stroke)), 0),
    motion_type: "Rise",
    cycle_angle: 2 * Math.PI,
    resolution: 720,
  };
}

export interface DynamicPoint {
  angle_deg: number;
  inertia_force: number;
  spring_force: number;
  damping_force: number;
  external_force: number;
  total_axial_force: number;
  normal_force: number;
  cam_torque: number;
  hertz_pressure: number;
}

export interface DynamicResult {
  points: DynamicPoint[];
  max_normal_force: number;
  max_cam_torque: number;
  max_hertz_pressure: number;
}

export type ViewTab = 'kinematic' | 'cam' | 'animation' | 'dynamics';

export interface AppContextType {
  wasmReady: boolean;
  evalResult: MotionPoint[];
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  segHistory: HistoryState<SegmentDef[]>;
  segments: SegmentDef[];
  setSegments: (value: SegmentDef[] | ((prev: SegmentDef[]) => SegmentDef[])) => void;
  calcTimeMs: number;
  chartLayout: ChartLayout;
  setChartLayout: React.Dispatch<React.SetStateAction<ChartLayout>>;
  activeTab: ViewTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ViewTab>>;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  locale: Locale;
  setLocale: React.Dispatch<React.SetStateAction<Locale>>;
  rpm: number;
  setRpm: React.Dispatch<React.SetStateAction<number>>;
  
  camType: CamDisplayType;
  setCamType: React.Dispatch<React.SetStateAction<CamDisplayType>>;
  camBaseRadius: number;
  setCamBaseRadius: React.Dispatch<React.SetStateAction<number>>;
  camRollerRadius: number;
  setCamRollerRadius: React.Dispatch<React.SetStateAction<number>>;
  camOffset: number;
  setCamOffset: React.Dispatch<React.SetStateAction<number>>;
  camContour: CamContourData | null;
  
  camLength: number;
  setCamLength: React.Dispatch<React.SetStateAction<number>>;
  camGrooveDepth: number;
  setCamGrooveDepth: React.Dispatch<React.SetStateAction<number>>;
  linearContour: LinearCamContourData | null;

  // Dynamics
  equivMass: number; setEquivMass: React.Dispatch<React.SetStateAction<number>>;
  springPreload: number; setSpringPreload: React.Dispatch<React.SetStateAction<number>>;
  springStiffness: number; setSpringStiffness: React.Dispatch<React.SetStateAction<number>>;
  damping: number; setDamping: React.Dispatch<React.SetStateAction<number>>;
  externalForce: number; setExternalForce: React.Dispatch<React.SetStateAction<number>>;
  camThickness: number; setCamThickness: React.Dispatch<React.SetStateAction<number>>;
  dynResult: DynamicResult | null;
  
  // Materials
  camMaterial: string; setCamMaterial: React.Dispatch<React.SetStateAction<string>>;
  rollerMaterial: string; setRollerMaterial: React.Dispatch<React.SetStateAction<string>>;
  materials: Record<string, { e: number; v: number; density: number; yield: number }>;

  unitSystem: UnitSystem;
  handleUnitChange: (newUnits: UnitSystem) => void;

  segmentBoundaries: SegmentBoundary[];
  calculateProfile: () => void;
  handleImport: () => void;
  importRef: React.RefObject<HTMLInputElement | null>;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wasmReady, setWasmReady] = useState(false);
  const [evalResult, setEvalResult] = useState<MotionPoint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const segHistory = useHistory<SegmentDef[]>(DEFAULT_SEGMENTS);
  const segments = segHistory.current;
  const setSegments = segHistory.set;
  const [calcTimeMs, setCalcTimeMs] = useState<number>(0);
  const [chartLayout, setChartLayout] = useState<ChartLayout>('vertical');
  const [activeTab, setActiveTab] = useState<ViewTab>('kinematic');

  const [theme, setTheme] = useState<Theme>('dark');
  const [locale, setLocale] = useState<Locale>('en');
  const [rpm, setRpm] = useState<number>(0);
  const importRef = useRef<HTMLInputElement>(null);

  const [camType, setCamType] = useState<CamDisplayType>('rotary');
  const [camBaseRadius, setCamBaseRadius] = useState(60);
  const [camRollerRadius, setCamRollerRadius] = useState(10);
  const [camOffset, setCamOffset] = useState(0);
  const [camContour, setCamContour] = useState<CamContourData | null>(null);
  
  const [camLength, setCamLength] = useState(300);
  const [camGrooveDepth, setCamGrooveDepth] = useState(0);
  const [linearContour, setLinearContour] = useState<LinearCamContourData | null>(null);

  // Dynamics
  const [equivMass, setEquivMass] = useState<number>(10.0); // kg
  const [springPreload, setSpringPreload] = useState<number>(500.0); // N
  const [springStiffness, setSpringStiffness] = useState<number>(10.0); // N/mm
  const [damping, setDamping] = useState<number>(0.0); // Ns/m
  const [externalForce, setExternalForce] = useState<number>(0.0); // N
  const [camThickness, setCamThickness] = useState<number>(20.0); // mm
  const [dynResult, setDynResult] = useState<DynamicResult | null>(null);
  
  // Materials
  const [camMaterial, setCamMaterial] = useState<string>('Steel');
  const [rollerMaterial, setRollerMaterial] = useState<string>('Steel');
  
  const materials: Record<string, { e: number; v: number; density: number; yield: number }> = {
    'Steel': { e: 210000, v: 0.3, density: 7.85, yield: 600 },
    'Cast Iron': { e: 170000, v: 0.26, density: 7.2, yield: 400 },
    'Aluminum': { e: 70000, v: 0.33, density: 2.7, yield: 150 },
    'Bronze': { e: 110000, v: 0.34, density: 8.8, yield: 250 },
  };

  const getEqModulus = () => {
    const m1 = materials[camMaterial] || materials['Steel'];
    const m2 = materials[rollerMaterial] || materials['Steel'];
    const factor1 = (1 - m1.v * m1.v) / m1.e;
    const factor2 = (1 - m2.v * m2.v) / m2.e;
    return 2.0 / (factor1 + factor2);
  };

  const [unitSystem, setUnitSystem] = useState<UnitSystem>(DEFAULT_UNITS);
  const prevUnitsRef = useRef<UnitSystem>(DEFAULT_UNITS);

  const handleUnitChange = useCallback((newUnits: UnitSystem) => {
    const prev = prevUnitsRef.current;
    if (newUnits.length !== prev.length) {
      const cl = (v: number) => convertLength(v, prev.length, newUnits.length);
      setSegments(segs => segs.map(s => ({
        ...s,
        stroke: Number(cl(s.stroke).toFixed(4)),
        s_start: Number(cl(s.s_start).toFixed(4)),
      })));
      setCamBaseRadius(v => Number(cl(v).toFixed(4)));
      setCamRollerRadius(v => Number(cl(v).toFixed(4)));
      setCamOffset(v => Number(cl(v).toFixed(4)));
      setCamLength(v => Number(cl(v).toFixed(4)));
      setCamGrooveDepth(v => Number(cl(v).toFixed(4)));
      setCamThickness(v => Number(cl(v).toFixed(4)));
    }
    if (newUnits.angle !== prev.angle) {
      const ca = (v: number) => convertAngle(v, prev.angle, newUnits.angle);
      setSegments(segs => segs.map(s => ({
        ...s,
        phi_start: Number(ca(s.phi_start).toFixed(4)),
        phi_end: Number(ca(s.phi_end).toFixed(4)),
      })));
    }
    prevUnitsRef.current = newUnits;
    setUnitSystem(newUnits);
  }, [setSegments]);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const handleImport = useCallback(() => { importRef.current?.click(); }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.segments && Array.isArray(data.segments)) {
          const imported = data.segments.map((s: any) => ({
            id: s.id || crypto.randomUUID(),
            name: s.name || 'Imported',
            law: s.law || 'Dwell',
            phi_start: s.phi_start ?? 0,
            phi_end: s.phi_end ?? 60,
            stroke: s.stroke ?? 0,
            s_start: s.s_start ?? 0,
            boundary_conditions: s.boundary_conditions || {
              start_velocity: { Fixed: 0 }, end_velocity: { Fixed: 0 },
              start_acceleration: { Fixed: 0 }, end_acceleration: { Fixed: 0 },
              start_jerk: 'Free', end_jerk: 'Free',
            },
            color: s.color || '#3b82f6',
            metadata: s.metadata || {},
            bezier_cx1: s.bezier_cx1, bezier_cy1: s.bezier_cy1,
            bezier_cx2: s.bezier_cx2, bezier_cy2: s.bezier_cy2,
          }));
          setSegments(imported);
          if (data.cam) {
            if (data.cam.base_radius) setCamBaseRadius(data.cam.base_radius);
            if (data.cam.roller_radius) setCamRollerRadius(data.cam.roller_radius);
            if (data.cam.offset !== undefined) setCamOffset(data.cam.offset);
            if (data.cam.type) setCamType(data.cam.type);
            if (data.cam.cam_length) setCamLength(data.cam.cam_length);
            if (data.cam.groove_depth !== undefined) setCamGrooveDepth(data.cam.groove_depth);
          }
          if (data.dynamics) {
            if (data.dynamics.mass) setEquivMass(data.dynamics.mass);
            if (data.dynamics.preload) setSpringPreload(data.dynamics.preload);
            if (data.dynamics.stiffness) setSpringStiffness(data.dynamics.stiffness);
            if (data.dynamics.thickness) setCamThickness(data.dynamics.thickness);
          }
        }
      } catch (err) {
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setSegments]);

  const segmentBoundaries: SegmentBoundary[] = useMemo(() =>
    segments.map(seg => ({
      phi_start: seg.phi_start,
      phi_end: seg.phi_end,
      name: seg.name,
      color: seg.color || '#3b82f6',
    })),
    [segments]
  );

  const calculateProfile = useCallback(() => {
    if (!wasmReady) return;
    try {
      const profile = buildWasmProfile(segments, unitSystem);
      const t0 = performance.now();
      const result = evaluate_profile(profile, 720);
      const t1 = performance.now();
      setCalcTimeMs(Math.round((t1 - t0) * 100) / 100);
      setEvalResult(result);

      const iBaseR = lengthToInternal(camBaseRadius, unitSystem.length);
      const iRollerR = lengthToInternal(camRollerRadius, unitSystem.length);
      const iOffset = lengthToInternal(camOffset, unitSystem.length);
      const iLength = lengthToInternal(camLength, unitSystem.length);
      const iGroove = lengthToInternal(camGrooveDepth, unitSystem.length);
      const iThickness = lengthToInternal(camThickness, unitSystem.length);
      const kStiffnessInternal = unitSystem.length === 'in' ? springStiffness / 25.4 : springStiffness;

      try {
        const camProfile = buildWasmProfile(segments, unitSystem);
        const rotaryResult = evaluate_cam_contour(camProfile, iBaseR, iRollerR, iOffset, 720);
        setCamContour(rotaryResult);
        const linearResult = evaluate_linear_cam_contour(camProfile, iLength, iRollerR, iGroove, 720);
        setLinearContour(linearResult);

        // Evaluate Dynamics if rpm is non-zero
        // We import evaluate_dynamics from motus_wasm
        // require the user to have rpm > 0
        if (rpm > 0) {
            const dynResultData = evaluate_dynamics(
                camProfile, equivMass, rpm, springPreload, kStiffnessInternal, damping, externalForce,
                iThickness, iRollerR, iBaseR, iOffset, getEqModulus(), 720
            );
            setDynResult(dynResultData);
        } else {
            setDynResult(null);
        }

      } catch (e) {
        console.error("Cam eval error", e);
      }
    } catch (e) {
      console.error("Evaluation failed", e);
    }
  }, [wasmReady, segments, camBaseRadius, camRollerRadius, camOffset, camLength, camGrooveDepth, unitSystem, rpm, equivMass, springPreload, springStiffness, damping, externalForce, camThickness]);

  const handleExport = useCallback(() => {
    const data = {
      segments,
      cam: {
        type: camType, base_radius: camBaseRadius, roller_radius: camRollerRadius,
        offset: camOffset, cam_length: camLength, groove_depth: camGrooveDepth
      },
      dynamics: {
        mass: equivMass, preload: springPreload, stiffness: springStiffness, damping, externalForce, thickness: camThickness
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cam_profile_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [segments, camType, camBaseRadius, camRollerRadius, camOffset, camLength, camGrooveDepth, equivMass, springPreload, springStiffness, damping, externalForce, camThickness]);

  useEffect(() => {
    init().then(() => setWasmReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    if (wasmReady) {
      const timer = setTimeout(calculateProfile, 300);
      return () => clearTimeout(timer);
    }
  }, [segments, wasmReady, camBaseRadius, camRollerRadius, camOffset, camLength, camGrooveDepth, unitSystem, rpm, equivMass, springPreload, springStiffness, damping, externalForce, camThickness, camMaterial, rollerMaterial]);

  const value: AppContextType = {
    wasmReady, evalResult, projects, setProjects, segHistory, segments, setSegments,
    calcTimeMs, chartLayout, setChartLayout, activeTab, setActiveTab,
    theme, setTheme, locale, setLocale, rpm, setRpm,
    camType, setCamType, camBaseRadius, setCamBaseRadius, camRollerRadius, setCamRollerRadius,
    camOffset, setCamOffset, camContour, camLength, setCamLength, camGrooveDepth, setCamGrooveDepth, linearContour,
    equivMass, setEquivMass, springPreload, setSpringPreload,
    springStiffness, setSpringStiffness, damping, setDamping, externalForce, setExternalForce,
    camThickness, setCamThickness, dynResult,
    camMaterial, setCamMaterial, rollerMaterial, setRollerMaterial, materials,
    unitSystem, handleUnitChange, segmentBoundaries, calculateProfile,
    handleImport, importRef, handleFileImport, handleExport
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
