export type Role = 'PACIENTE' | 'RECEPCIONISTA' | 'MEDICO' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tutor?: Tutor;
  doctor?: Doctor;
}

export interface Tutor {
  id: string;
  userId: string;
  phone: string;
  address: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  animals?: Animal[];
}

export interface Animal {
  id: string;
  tutorId: string;
  name: string;
  species: string;
  breed: string;
  birth_date: string;
  weight: number;
  allergies?: string;
  photo_url?: string;
  tutor?: Tutor;
}

export interface Doctor {
  id: string;
  userId: string;
  specialty: string;
  crm: string;
  schedule_config?: any;
  user: {
    id: string;
    name: string;
    email: string;
  };
  doctor_rooms?: { room: Room }[];
}

export interface Room {
  id: string;
  name: string;
  sector: 'TRIAGEM' | 'CONSULTORIO' | 'INTERNACAO' | 'EXAMES';
}

export interface Appointment {
  id: string;
  animalId: string;
  doctorId: string;
  roomId: string;
  appointment_datetime: string;
  status: 'AGENDADA' | 'EM_ATENDIMENTO' | 'CONCLUIDA' | 'FALTOU' | 'CANCELADA';
  observation?: string;
  animal: Animal;
  doctor: Doctor;
  room: Room;
}

export interface QueueNumber {
  id: string;
  code: string;
  classification: 'GERAL' | 'PREFERENCIAL' | 'URGENTE';
  generation_datetime: string;
  status: 'AGUARDANDO' | 'CHAMADA' | 'ATENDIDA' | 'CANCELADA';
  animalId?: string;
  animal?: {
    name: string;
    tutor: {
      user: { name: string };
    };
  };
}

export interface Prescription {
  id: string;
  appointmentId?: string;
  animalId: string;
  doctorId: string;
  prescription_date: string;
  notes?: string;
  file_path?: string;
  animal: Animal;
  doctor: Doctor;
  medications: PrescriptionMedication[];
}

export interface PrescriptionMedication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration?: string;
}

export interface Vaccine {
  id: string;
  animalId: string;
  name: string;
  dosage: string;
  application_date: string;
  next_dose_date?: string;
  batch?: string;
  animal: Animal;
}

export interface ExamType {
  id: string;
  name: string;
  description?: string;
}

export interface RequestedExam {
  id: string;
  animalId: string;
  doctorId: string;
  examTypeId: string;
  request_date: string;
  execution_date?: string;
  file_path?: string;
  result_text?: string;
  status: 'SOLICITADO' | 'REALIZADO';
  animal: Animal;
  doctor: Doctor;
  exam_type: ExamType;
}

export interface AuthResponse {
  message: string;
  user: User;
}