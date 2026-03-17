export interface Site {
  id: number;
  name: string;
  target_files: number;
}

export interface Employee {
  id: number;
  name: string;
  site_id: number;
}

export interface ScanningData {
  employee_id: number;
  name: string;
  is_active: number;
  files: number | null;
  pages: number | null;
  date: string;
}

export interface Stats {
  overall: {
    total_files: number | null;
    total_pages: number | null;
    target_files: number;
  };
  monthly: Array<{
    month: string;
    files: number;
    pages: number;
    extra_pages: number;
  }>;
  weekly: Array<{
    date: string;
    files: number;
    pages: number;
  }>;
  mode: 'main' | 'personal';
}
