import type { MotionPoint } from '../components/KinematicChart';
import type { CamContourData, LinearCamContourData } from '../components/CamContourChart';
import type { UnitSystem } from '../units';
import { lengthLabel, angleLabel, lengthFromInternal } from '../units';

export function exportKinematicsCSV(data: MotionPoint[], units: UnitSystem) {
  if (data.length === 0) return;

  const lu = lengthLabel(units.length);
  const au = angleLabel(units.angle);
  // Time derivatives typically use /rad or /deg in display
  // We export exactly what is shown in the UI

  const header = `Angle (${au}),Position (${lu}),Velocity (${lu}/${au}),Acceleration (${lu}/${au}²),Jerk (${lu}/${au}³)\n`;
  const rows = data.map((pt, index) => {
    const angle_deg = (index / Math.max(1, data.length - 1)) * 360;
    const angle = units.angle === 'rad' ? angle_deg * Math.PI / 180 : angle_deg;
    return `${angle.toFixed(4)},${pt.s.toFixed(4)},${pt.v.toFixed(4)},${pt.a.toFixed(4)},${pt.j.toFixed(4)}`;
  }).join('\n');

  downloadCSV(header + rows, 'motus_nova_kinematics.csv');
}

export function exportRotaryContourCSV(data: CamContourData, units: UnitSystem) {
  if (!data || data.points.length === 0) return;

  const lu = lengthLabel(units.length);
  const au = angleLabel(units.angle);

  const header = `Angle (${au}),S (${lu}),Cam X (${lu}),Cam Y (${lu}),Pressure Angle (°),Curvature Radius (${lu})\n`;
  const rows = data.points.map(pt => {
    // Note: the core computes things in internal units (mm, degrees). 
    // We should convert them to display units for the CSV to match the UI.
    const x = lengthFromInternal(pt.x, units.length);
    const y = lengthFromInternal(pt.y, units.length);
    const s = lengthFromInternal(pt.s, units.length);
    const rho = lengthFromInternal(pt.curvature_radius, units.length);
    // angle_deg is always degrees from core, we convert it if needed
    const angle = units.angle === 'rad' ? pt.angle_deg * Math.PI / 180 : pt.angle_deg;

    return `${angle.toFixed(4)},${s.toFixed(4)},${x.toFixed(4)},${y.toFixed(4)},${pt.pressure_angle.toFixed(4)},${rho.toFixed(4)}`;
  }).join('\n');

  downloadCSV(header + rows, 'motus_nova_rotary_contour.csv');
}

export function exportLinearContourCSV(data: LinearCamContourData, units: UnitSystem) {
  if (!data || data.points.length === 0) return;

  const lu = lengthLabel(units.length);

  const header = `X (${lu}),Upper Y (${lu}),Lower Y (${lu}),Pressure Angle (°),Curvature Radius (${lu})\n`;
  const rows = data.points.map(pt => {
    const x = lengthFromInternal(pt.x, units.length);
    const y_up = lengthFromInternal(pt.y_upper, units.length);
    const y_low = lengthFromInternal(pt.y_lower, units.length);
    const rho = lengthFromInternal(pt.curvature_radius, units.length);

    return `${x.toFixed(4)},${y_up.toFixed(4)},${y_low.toFixed(4)},${pt.pressure_angle.toFixed(4)},${rho.toFixed(4)}`;
  }).join('\n');

  downloadCSV(header + rows, 'motus_nova_linear_contour.csv');
}

export function exportContourDXF(data: CamContourData, units: UnitSystem) {
  if (!data || data.points.length === 0) return;

  // We have to import DxfWriter dynamically or statically. Since it's a browser env, we can import it.
  import('dxf-writer').then((DXFWriter) => {
    // dxf-writer might export default as DxfWriter or just the class.
    const DxfWriterClass = DXFWriter.default || DXFWriter;
    const dxf = new (DxfWriterClass as any)();
    
    // Create a new layer
    dxf.addLayer('CAM_CONTOUR', DxfWriterClass.ACI.BLUE, 'CONTINUOUS');
    dxf.setActiveLayer('CAM_CONTOUR');

    const points = data.points.map(pt => [
      lengthFromInternal(pt.x, units.length),
      lengthFromInternal(pt.y, units.length)
    ]);

    // Draw the polyline (closed)
    dxf.drawPolyline(points, true);

    // Get the dxf string
    const dxfString = dxf.toDxfString();

    // Trigger download
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'motus_nova_cam_contour.dxf');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }).catch(err => {
    console.error("Failed to load dxf-writer", err);
    alert("Could not load DXF export library.");
  });
}

export async function exportReportPDF() {
  try {
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);
    const html2canvas = html2canvasModule.default;
    const jsPDF = jsPDFModule.default;

    // Grab the main view container
    const element = document.getElementById('main-view-content');
    if (!element) {
      alert("Could not find main view content to export.");
      return;
    }

    // Take snapshot
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    // Create PDF (A4 landscape is usually better for charts)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate aspect ratio
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // Add title
    pdf.setFontSize(18);
    pdf.text('MOTUS NOVA - Kinematic & Dynamic Report', 10, 15);
    pdf.setFontSize(10);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 10, 22);

    // Add image
    if (imgHeight <= pdfHeight - 30) {
      pdf.addImage(imgData, 'PNG', 0, 30, pdfWidth, imgHeight);
    } else {
      // Split over multiple pages if it's very long
      let position = 30;
      let heightLeft = imgHeight;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= (pdfHeight - 30);
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
    }

    pdf.save('motus_nova_report.pdf');
  } catch (err) {
    console.error("Failed to export PDF", err);
    alert("Could not generate PDF report.");
  }
}

function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
