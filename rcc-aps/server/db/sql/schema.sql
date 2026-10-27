-- RCC-APS MySQL Schema (MariaDB 10.4)
-- Migration source: server/db/db.json (state blob)
-- Encoding must be utf8mb4 to hold peso sign and emoji.

CREATE DATABASE IF NOT EXISTS rcc_aps
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rcc_aps;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INT PRIMARY KEY,
  first          VARCHAR(100) NOT NULL DEFAULT '',
  last           VARCHAR(100) NOT NULL DEFAULT '',
  email          VARCHAR(200) NOT NULL DEFAULT '',
  role           VARCHAR(50)  NOT NULL DEFAULT 'Employee',
  status         VARCHAR(20)  NOT NULL DEFAULT 'Active',
  date           DATE NULL DEFAULT NULL,
  salary         DECIMAL(12,2) NOT NULL DEFAULT 0,
  classification VARCHAR(50)  NOT NULL DEFAULT 'Non-Teaching',
  department     VARCHAR(120) NOT NULL DEFAULT '',
  hireDate       DATE NULL DEFAULT NULL,
  hourlyRate     DECIMAL(10,2) NOT NULL DEFAULT 0,
  absenceDays    DECIMAL(6,2) NOT NULL DEFAULT 0,
  hoursWorked    DECIMAL(8,2) NOT NULL DEFAULT 0,
  endDate        DATE NULL DEFAULT NULL,
  rankId         INT NULL DEFAULT NULL,
  rankName       VARCHAR(120) NOT NULL DEFAULT '',
  rateCustom     TINYINT(1) NOT NULL DEFAULT 0,
  schoolLevel    VARCHAR(20) NOT NULL DEFAULT '',
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── AUTH (login credentials keyed by user id) ────────────────
CREATE TABLE IF NOT EXISTS auth (
  id      INT PRIMARY KEY,
  email   VARCHAR(200) NOT NULL DEFAULT '',
  pass    VARCHAR(200) NOT NULL DEFAULT '',
  label   VARCHAR(50)  NOT NULL DEFAULT '',
  icon    VARCHAR(20)  NOT NULL DEFAULT '',
  page    VARCHAR(50)  NOT NULL DEFAULT '',
  role    VARCHAR(20)  NOT NULL DEFAULT 'employee',
  status  VARCHAR(20)  NOT NULL DEFAULT 'Active',
  googleSub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL,
  UNIQUE KEY uk_auth_google_sub (googleSub),
  UNIQUE KEY uk_auth_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PROFILES (per-user phone/address) ──────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id       INT PRIMARY KEY,
  empPhone VARCHAR(40) NOT NULL DEFAULT '',
  empAddr  VARCHAR(255) NOT NULL DEFAULT '',
  photo    MEDIUMTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── CASH ADVANCES (per user id) ──────────────────────────────
CREATE TABLE IF NOT EXISTS cash_advances (
  id     INT PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── BONUS TYPES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bonus_types (
  id          INT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL DEFAULT '',
  kind        VARCHAR(30)  NOT NULL DEFAULT '',
  value       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `desc`      VARCHAR(255) NOT NULL DEFAULT '',
  status      VARCHAR(20)  NOT NULL DEFAULT 'Active',
  releaseDate DATE NULL DEFAULT NULL,
  endDate     DATE NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── BONUS PAYOUTS (key: empId + year) ────────────────────────
CREATE TABLE IF NOT EXISTS bonus_payouts (
  empId INT NOT NULL,
  year  INT NOT NULL DEFAULT 0,
  date  DATE NULL DEFAULT NULL,
  PRIMARY KEY (empId, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── DEDUCTION CATEGORIES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS deduction_categories (
  id     INT PRIMARY KEY,
  name   VARCHAR(120) NOT NULL DEFAULT '',
  type   VARCHAR(30)  NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  `desc` VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(20)  NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PAYROLL RECORDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_records (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  empId         INT NOT NULL,
  name          VARCHAR(150) NOT NULL DEFAULT '',
  month         INT NOT NULL DEFAULT 0,
  monthName     VARCHAR(20)  NOT NULL DEFAULT '',
  year          INT NOT NULL DEFAULT 0,
  period        VARCHAR(50)  NOT NULL DEFAULT '',
  gross         DECIMAL(12,2) NOT NULL DEFAULT 0,
  deMinimisSum  DECIMAL(12,2) NOT NULL DEFAULT 0,
  thirteenth    DECIMAL(12,2) NOT NULL DEFAULT 0,
  thirteenTaxable DECIMAL(12,2) NOT NULL DEFAULT 0,
  thirteenExempt  DECIMAL(12,2) NOT NULL DEFAULT 0,
  thirteenTax     DECIMAL(12,2) NOT NULL DEFAULT 0,
  net           DECIMAL(12,2) NOT NULL DEFAULT 0,
  sss           DECIMAL(12,2) NOT NULL DEFAULT 0,
  phil          DECIMAL(12,2) NOT NULL DEFAULT 0,
  pag           DECIMAL(12,2) NOT NULL DEFAULT 0,
  bir           DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash          DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonuses       MEDIUMTEXT NOT NULL,
  subjectBreakdown TEXT,
  customDeds    TEXT,
  salaryBase    DECIMAL(12,2) NULL,
  absenceWorkDays DECIMAL(6,2) NULL,
  absenceDays   DECIMAL(6,2) NULL,
  teachingSemester VARCHAR(20) NULL,
  teachingSchoolYear VARCHAR(30) NULL,
  payNote       VARCHAR(500) DEFAULT '',
  date          DATE NULL DEFAULT NULL,
  KEY idx_payroll_emp (empId),
  KEY idx_payroll_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SSS CONTRIBUTION TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sss_table (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  `range` VARCHAR(80) NOT NULL DEFAULT '',
  emp   DECIMAL(10,2) NOT NULL DEFAULT 0,
  er    DECIMAL(10,2) NOT NULL DEFAULT 0,
  min   DECIMAL(12,2) NULL,
  max   DECIMAL(12,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PHILHEALTH CONFIG (single row) ───────────────────────────
CREATE TABLE IF NOT EXISTS phil_data (
  id      INT PRIMARY KEY DEFAULT 1,
  rate    DECIMAL(6,2) NOT NULL DEFAULT 5,
  min     DECIMAL(12,2) NOT NULL DEFAULT 500,
  max     DECIMAL(12,2) NOT NULL DEFAULT 5000,
  floor   DECIMAL(12,2) NOT NULL DEFAULT 10000,
  ceiling DECIMAL(12,2) NOT NULL DEFAULT 100000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PAG-IBIG CONFIG (single row) ─────────────────────────────
CREATE TABLE IF NOT EXISTS pag_data (
  id     INT PRIMARY KEY DEFAULT 1,
  rate1  DECIMAL(6,2) NOT NULL DEFAULT 1,
  rate2  DECIMAL(6,2) NOT NULL DEFAULT 2,
  empMax DECIMAL(12,2) NOT NULL DEFAULT 100,
  erMax  DECIMAL(12,2) NOT NULL DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── BIR WITHHOLDING TABLE ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bir_table (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  `range` VARCHAR(80)  NOT NULL DEFAULT '',
  base  DECIMAL(12,2) NOT NULL DEFAULT 0,
  rate  DECIMAL(6,2)  NOT NULL DEFAULT 0,
  min   DECIMAL(12,2) NULL,
  max   DECIMAL(12,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── TEACHER RANKS (faculty pay rate: per hour / workload / month) ─
CREATE TABLE IF NOT EXISTS teacher_ranks (
  id          INT PRIMARY KEY,
  department  VARCHAR(20)  NOT NULL DEFAULT 'College',
  rank        VARCHAR(120) NOT NULL DEFAULT '',
  rate        DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── TEACHING LOAD RECORDS (employee-submitted, per semester) ───
-- One row per teacher per semester+SY. level/rank/rate are snapshots
-- of the profile at save time. workloadType: 'hours' | 'absences'.
CREATE TABLE IF NOT EXISTS teaching_load_records (
  id             INT PRIMARY KEY,
  empId          INT NOT NULL,
  semester       VARCHAR(20)  NOT NULL DEFAULT '',
  schoolYear     VARCHAR(30)  NOT NULL DEFAULT '',
  classification VARCHAR(30)  NOT NULL DEFAULT 'Teaching',
  level          VARCHAR(30)  NOT NULL DEFAULT '',
  rankId         INT          NOT NULL DEFAULT 0,
  rankName       VARCHAR(120) NOT NULL DEFAULT '',
  rate           DECIMAL(10,2) NOT NULL DEFAULT 0,
  rateUnit       VARCHAR(30)  NOT NULL DEFAULT '',
  salary         DECIMAL(12,2) NOT NULL DEFAULT 0,
  workloadType   VARCHAR(20)  NOT NULL DEFAULT 'hours',
  workloadValue  DECIMAL(6,2) NOT NULL DEFAULT 0,
  absences       DECIMAL(6,2) NOT NULL DEFAULT 0,
  computedPay    DECIMAL(12,2) NOT NULL DEFAULT 0,
  savedAt        VARCHAR(40)  NOT NULL DEFAULT '',
  UNIQUE KEY uk_tload_emp_sem (empId, semester, schoolYear)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SCHEDULE OF CLASSES rows (per teaching load record) ────────
CREATE TABLE IF NOT EXISTS teaching_load_classes (
  id             INT PRIMARY KEY,
  recordId       INT NOT NULL,
  subject        VARCHAR(150) NOT NULL DEFAULT '',
  level          VARCHAR(30)  NOT NULL DEFAULT '',
  deptCode       VARCHAR(30)  NOT NULL DEFAULT '',
  timeStart      VARCHAR(20)  NOT NULL DEFAULT '',
  timeEnd        VARCHAR(20)  NOT NULL DEFAULT '',
  days           VARCHAR(30)  NOT NULL DEFAULT '',
  studentsMale   INT NOT NULL DEFAULT 0,
  studentsFemale INT NOT NULL DEFAULT 0,
  roomNo         VARCHAR(20)  NOT NULL DEFAULT '',
  googleCode     VARCHAR(60)  NOT NULL DEFAULT '',
  hoursPerWeek   DECIMAL(6,2) NOT NULL DEFAULT 0,
  sortOrder      INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── KEY-VALUE CONFIG (next ids, workDays, limit, dedMeta, savedAt) ─
CREATE TABLE IF NOT EXISTS app_config (
  cfg_key   VARCHAR(60) PRIMARY KEY,
  cfg_value VARCHAR(1024) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── LEAVE TYPES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_types (
  id     INT PRIMARY KEY,
  name   VARCHAR(80) NOT NULL DEFAULT '',
  isPaid TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── LEAVE RECORDS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_records (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  empId     INT NOT NULL,
  typeId    INT NOT NULL,
  startDate DATE NULL DEFAULT NULL,
  endDate   DATE NULL DEFAULT NULL,
  days      DECIMAL(6,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ATTENDANCE (imported from HRIS) ──────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  empId         INT NULL DEFAULT NULL,
  employeeId    VARCHAR(40) NOT NULL DEFAULT '',
  employeeEmail VARCHAR(200) NOT NULL DEFAULT '',
  date          DATE NULL DEFAULT NULL,
  clockInAt     VARCHAR(40) NOT NULL DEFAULT '',
  clockOutAt    VARCHAR(40) NOT NULL DEFAULT '',
  hours         DECIMAL(6,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_att_emp_date (empId, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
