import type { Profile, Medication, DoseLog, ExportData } from '../types';

export function exportProfileData(
  profile: Profile,
  medications: Medication[],
  recentLogs: DoseLog[]
): string {
  const data: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    profile,
    medications: medications.map((m) => ({ ...m, id: undefined })),
    recentLogs: recentLogs.slice(-100).map((l) => ({ ...l, id: undefined })),
  };

  return JSON.stringify(data, null, 2);
}

export function downloadExport(profile: Profile, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = profile.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `pastillero_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportData(content: string): ExportData | null {
  try {
    const data = JSON.parse(content) as ExportData;
    if (!data.version || !data.profile || !Array.isArray(data.medications)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function generateShareableText(profile: Profile, medications: Medication[]): string {
  const lines: string[] = [
    `=== PASTILLERO - Medicación de ${profile.name} ===`,
    `Exportado: ${new Date().toLocaleDateString('es-AR', { dateStyle: 'long' })}`,
    '',
  ];

  for (const med of medications.filter((m) => m.active)) {
    lines.push(`• ${med.name} (${med.dosage})`);
    lines.push(`  Tipo: ${typeLabel(med.type)}`);
    lines.push(`  Horarios: ${med.scheduleTimes.map((t) => t.time).join(', ')}`);
    if (med.instructions) lines.push(`  Instrucciones: ${med.instructions}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('Para importar en la app Pastillero, use el archivo .json adjunto.');

  return lines.join('\n');
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    pill: 'Pastilla/Comprimido',
    syrup: 'Jarabe',
    injection: 'Inyección',
    drops: 'Gotas',
    patch: 'Parche',
    inhaler: 'Inhalador',
    other: 'Otro',
  };
  return labels[type] ?? type;
}
