import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Prescription } from '../types';
import { FileText, Download, Loader, Pill } from 'lucide-react';

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      const response = await api.get('/prescriptions');
      setPrescriptions(response.data.prescriptions || []);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (id: string) => {
    try {
      const response = await api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receita_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Receitas</h1>
        <p className="text-gray-500 mt-1">Visualize e baixe as receitas médicas</p>
      </div>

      <div className="space-y-4">
        {prescriptions.map((rx) => (
          <div key={rx.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Receita #{rx.id.slice(0, 8)}</h3>
                  <p className="text-sm text-gray-500">
                    {rx.animal.name} - {rx.animal.species}
                  </p>
                  <p className="text-sm text-gray-500">
                    Dr(a). {rx.doctor.user.name} | {new Date(rx.prescription_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => downloadPDF(rx.id)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
              >
                <Download className="w-4 h-4" />
                Baixar PDF
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Pill className="w-4 h-4" />
                Medicamentos prescritos:
              </h4>
              <div className="space-y-2">
                {rx.medications.map((med) => (
                  <div key={med.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-800">{med.medication_name}</p>
                    <p className="text-gray-500">{med.dosage} - {med.frequency} {med.duration && `/ ${med.duration}`}</p>
                  </div>
                ))}
              </div>
            </div>

            {rx.notes && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800"><strong>Observações:</strong> {rx.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {prescriptions.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhuma receita encontrada</p>
        </div>
      )}
    </div>
  );
}