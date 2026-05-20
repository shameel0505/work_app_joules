export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  TASKER = 'TASKER',
  ADMIN = 'ADMIN'
}

export enum TaskStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED'
}

export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED'
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM'
}

export enum NotificationType {
  NEW_BID = 'NEW_BID',
  BID_ACCEPTED = 'BID_ACCEPTED',
  BID_REJECTED = 'BID_REJECTED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PROMO_APPLIED = 'PROMO_APPLIED'
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT'
}

export interface User {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tasker {
  id: string;
  userId: string;
  bio?: string;
  rating: number;
  completedTasksCount: number;
  location?: string;
  isVerified: boolean;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  customerId: string;
  taskerId?: string;
  categoryId: string;
  title: string;
  description: string;
  status: TaskStatus;
  location: string;
  budgetFils: number;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  
  customer?: User;
  tasker?: Tasker;
  category?: Category;
}

export interface Bid {
  id: string;
  taskId: string;
  taskerId: string;
  amountFils: number;
  message?: string;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;

  task?: Task;
  tasker?: Tasker;
}

export interface Message {
  id: string;
  taskId: string;
  senderId: string;
  content: string;
  type: MessageType;
  createdAt: string;
  updatedAt: string;

  task?: Task;
  sender?: User;
}

export interface Review {
  id: string;
  taskId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;

  task?: Task;
  reviewer?: User;
  reviewee?: User;
}

export interface Payment {
  id: string;
  taskId: string;
  customerId: string;
  amountFils: number;
  status: PaymentStatus;
  providerPaymentId?: string;
  createdAt: string;
  updatedAt: string;

  task?: Task;
  customer?: User;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  data?: any;
  createdAt: string;
  updatedAt: string;

  user?: User;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amountFils: number;
  description?: string;
  createdAt: string;
  updatedAt: string;

  user?: User;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUses?: number;
  usesCount: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedAddress {
  id: string;
  userId: string;
  title: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;

  user?: User;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;

  user?: User;
}
