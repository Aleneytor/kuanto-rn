// expo-file-system (SDK 54) movió la API clásica (documentDirectory,
// writeAsStringAsync, EncodingType) a /legacy. Se usa aquí porque XLSX genera
// base64 y esta API lo escribe directo. Migrable a File/Paths más adelante.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { fetchHistoricalRates, fetchUsdtHistory } from './rateService';

export interface ExportRow {
  date: string;
  bcvUsd: number | null;
  bcvEur: number | null;
  usdt: number | null;
  gap: number | null;
}

/**
 * Fetches and prepares historical data for export within a date range.
 */
export const fetchAndPrepareExportData = async (
  startDate: Date,
  endDate: Date
): Promise<ExportRow[]> => {
  try {
    console.log('[ExportService] Starting data fetch...');

    const [bcvData, usdtData] = await Promise.all([
      fetchHistoricalRates('all'),
      fetchUsdtHistory('all'),
    ]);

    console.log(`[ExportService] Fetched ${bcvData.length} BCV records and ${usdtData.length} USDT records`);

    const bcvMap = new Map(bcvData.map((item) => [item.date.split('T')[0], item]));
    const usdtMap = new Map(usdtData.map((item) => [item.date, item]));

    const dataRows: ExportRow[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    currentDate.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];

      const bcv = bcvMap.get(dateStr);
      const usdt = usdtMap.get(dateStr);

      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const bcvUsd = bcv && !isWeekend ? bcv.usd : null;
      const bcvEur = bcv && !isWeekend ? bcv.eur : null;
      const usdtPrice = usdt ? usdt.usdt : null;

      let gap: number | null = null;
      if (bcvUsd && usdtPrice) {
        gap = (usdtPrice - bcvUsd) / bcvUsd;
      }

      if (bcv || usdt) {
        dataRows.push({
          date: dateStr,
          bcvUsd,
          bcvEur,
          usdt: usdtPrice,
          gap,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dataRows.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('[ExportService] Error preparing data:', error);
    throw error;
  }
};

/**
 * Generates an Excel file and prompts sharing on mobile (or download on web).
 */
export const exportToExcel = async (data: ExportRow[]): Promise<boolean> => {
  try {
    const wsData = [
      ['Fecha', 'Tasa BCV (USD)', 'Tasa BCV (EUR)', 'Promedio USDT', 'Brecha (%)'],
      ...data.map((row) => [
        row.date,
        row.bcvUsd || 'N/A',
        row.bcvEur || 'N/A',
        row.usdt || 'N/A',
        row.gap !== null ? (row.gap * 100).toFixed(2) + '%' : 'N/A',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 15 }, // BCV USD
      { wch: 15 }, // BCV EUR
      { wch: 15 }, // USDT
      { wch: 12 }, // Gap
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Histórico Tasas');

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = `Historico_Tasas_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (Platform.OS === 'web') {
      const uri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
      const link = document.createElement('a');
      link.href = uri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Descargar Histórico de Tasas',
          UTI: 'com.microsoft.excel.xlsx', // iOS specific
        });
      } else {
        alert('No se puede compartir el archivo en este dispositivo');
      }
    }

    return true;
  } catch (error) {
    console.error('[ExportService] Error generating Excel:', error);
    throw error;
  }
};
