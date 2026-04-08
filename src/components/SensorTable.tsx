import React from 'react';
import { format } from 'date-fns';
import { SensorData } from '../types';
import { Droplets, Thermometer, Wind, RefreshCw, Download, Calendar, FileJson, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { 
  ref, 
  get, 
  query as dbQuery, 
  orderByChild, 
  startAt, 
  endAt 
} from 'firebase/database';
import { getTimestamp, formatTimestamp, parseSensorValue } from '../utils/sensorUtils';

interface SensorTableProps {
  data: SensorData[];
}

export const SensorTable: React.FC<SensorTableProps> = ({ data }) => {
  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<'csv' | 'xlsx' | 'json'>('csv');
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' });
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let exportData = data;

      // If date range is specified, fetch from Firebase
      if (dateRange.start || dateRange.end) {
        const logsRef = ref(db, 'sensor_logs');
        let logsQuery;

        const startTs = dateRange.start ? new Date(dateRange.start).getTime() : 0;
        const endTs = dateRange.end ? new Date(dateRange.end).getTime() + 86399999 : Date.now(); // End of day

        logsQuery = dbQuery(
          logsRef,
          orderByChild('timestamp'),
          startAt(startTs),
          endAt(endTs)
        );

        const snapshot = await get(logsQuery);
        if (snapshot.exists()) {
          const fetchedData: SensorData[] = [];
          snapshot.forEach((child) => {
            fetchedData.push({ id: child.key as string, ...child.val() });
          });
          exportData = fetchedData.reverse();
        } else {
          alert('No data found for the selected date range.');
          setIsExporting(false);
          return;
        }
      }

      if (exportData.length === 0) {
        alert('No data to export.');
        setIsExporting(false);
        return;
      }

      const fileName = `sensor_data_${format(new Date(), 'yyyyMMdd_HHmmss')}`;

      if (exportFormat === 'json') {
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        downloadFile(blob, `${fileName}.json`);
      } else if (exportFormat === 'csv') {
        const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Soil Moisture (%)'];
        const csvRows = exportData.map(log => [
          `"${formatTimestamp(log.timestamp)}"`,
          log.temperature,
          log.humidity,
          log.soil
        ].join(','));
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${fileName}.csv`);
      } else if (exportFormat === 'xlsx') {
        const worksheetData = exportData.map(log => ({
          Timestamp: formatTimestamp(log.timestamp),
          'Temperature (°C)': log.temperature,
          'Humidity (%)': log.humidity,
          'Soil Moisture (%)': log.soil
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sensor Data');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, `${fileName}.xlsx`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full glass-card rounded-[2.5rem] overflow-hidden relative group border border-white/5 shadow-2xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/40 via-blue-500/40 to-amber-500/40" />
      <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/[0.01]">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">System Logs</h3>
          <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.3em] mt-1">Real-time Data Stream • Last 20 Snapshots</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 rounded-2xl transition-all group/btn"
            >
              <Download size={14} className="group-hover/btn:translate-y-0.5 transition-transform" />
              Export Data
              {isExportOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            <AnimatePresence>
              {isExportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-80 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl p-6 z-50 backdrop-blur-xl"
                >
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Select Format</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'csv', icon: FileText, label: 'CSV' },
                          { id: 'xlsx', icon: FileSpreadsheet, label: 'Excel' },
                          { id: 'json', icon: FileJson, label: 'JSON' }
                        ].map((fmt) => (
                          <button
                            key={fmt.id}
                            onClick={() => setExportFormat(fmt.id as any)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                              exportFormat === fmt.id 
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                            }`}
                          >
                            <fmt.icon size={18} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">{fmt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Date Range (Optional)</label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Calendar size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                          <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            placeholder="Start Date"
                          />
                        </div>
                        <div className="relative">
                          <Calendar size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                          <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            placeholder="End Date"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleExport}
                      disabled={isExporting}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] glow-emerald disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {isExporting ? 'Processing...' : 'Download Report'}
                    </button>
                    
                    <p className="text-[8px] text-white/20 text-center uppercase tracking-widest">
                      Leave dates empty to export recent logs
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="px-5 py-2.5 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {data.length} Records Active
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white/[0.03] text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">
            <tr>
              <th className="px-10 py-6 font-black border-b border-white/5">Time Sequence</th>
              <th className="px-10 py-6 font-black border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Thermometer size={14} className="text-emerald-400" />
                  Temp
                </div>
              </th>
              <th className="px-10 py-6 font-black border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="text-blue-400" />
                  Hum
                </div>
              </th>
              <th className="px-10 py-6 font-black border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Droplets size={14} className="text-amber-400" />
                  Soil
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {data.length === 0 ? (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={4} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-8">
                      <div className="relative group/empty">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full group-hover/empty:bg-emerald-500/20 transition-all duration-1000" />
                        <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative z-10">
                          <RefreshCw className="text-white/20 animate-spin-slow" size={40} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-white/40 font-black text-sm uppercase tracking-[0.4em]">Awaiting Data Stream</p>
                        <p className="text-white/20 font-mono text-[10px] uppercase tracking-widest">Connect your ESP32 or enable simulation mode</p>
                      </div>
                    </div>
                  </td>
                </motion.tr>
              ) : (
                data.map((log, idx) => (
                  <motion.tr 
                    key={log.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ 
                      duration: 0.4,
                      delay: idx * 0.03 
                    }}
                    layout
                    className="hover:bg-white/[0.04] transition-all duration-300 group/row"
                  >
                    <td className="px-10 py-6 text-xs font-mono text-white/40 group-hover/row:text-white/80 transition-colors">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono text-emerald-400 text-glow group-hover/row:scale-110 transition-transform origin-left">
                          {parseSensorValue(log.temperature).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono uppercase">°C</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono text-blue-400 text-glow group-hover/row:scale-110 transition-transform origin-left">
                          {parseSensorValue(log.humidity).toFixed(1)}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono uppercase">%</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono text-amber-400 text-glow group-hover/row:scale-110 transition-transform origin-left">
                          {parseSensorValue(log.soil).toFixed(0)}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono uppercase">%</span>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};
