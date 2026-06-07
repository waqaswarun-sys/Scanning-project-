export interface Site {
  id: string | number;
  name: string;
  target_files: number;
}

export interface Employee {
  id: string | number;
  name: string;
  site_id: string | number;
}

export interface MouzaEntry {
  name: string;
  status: 'In Scanning' | 'Complete';
  years: string;
  type: 'RHZ' | 'Mutation' | 'Shajra';
  quantity: number | string;
}

export interface ScanningData {
  employee_id: string | number;
  name: string;
  is_active: number;
  files: number | null;
  pages: number | null;
  mouzas?: MouzaEntry[];
  date: string;
}

export interface Apps {
  id: string;
  name: string;
  download_url: string;
  image_url: string;
  description: string;
}

export interface Stats {
  overall: {
    total_files: number | null;
    total_pages: number | null;
    target_files: number;
    total_mouza_scanned?: number;
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
