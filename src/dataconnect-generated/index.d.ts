import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Category_Key {
  id: UUIDString;
  __typename?: 'Category_Key';
}

export interface CreateTaskData {
  task_insert: Task_Key;
}

export interface CreateTaskVariables {
  title: string;
  status: string;
  categoryId?: UUIDString | null;
}

export interface GetUserTasksData {
  tasks: ({
    id: UUIDString;
    title: string;
    status: string;
    dueDate?: TimestampString | null;
    category?: {
      name: string;
    };
  } & Task_Key)[];
}

export interface GetUserTasksVariables {
  userId: UUIDString;
}

export interface HabitLog_Key {
  id: UUIDString;
  __typename?: 'HabitLog_Key';
}

export interface Habit_Key {
  id: UUIDString;
  __typename?: 'Habit_Key';
}

export interface LogHabitCompletionData {
  habitLog_insert: HabitLog_Key;
}

export interface LogHabitCompletionVariables {
  habitId: UUIDString;
  date: DateString;
}

export interface Task_Key {
  id: UUIDString;
  __typename?: 'Task_Key';
}

export interface UpdateTaskStatusData {
  task_update?: Task_Key | null;
}

export interface UpdateTaskStatusVariables {
  id: UUIDString;
  status: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface GetUserTasksRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserTasksVariables): QueryRef<GetUserTasksData, GetUserTasksVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserTasksVariables): QueryRef<GetUserTasksData, GetUserTasksVariables>;
  operationName: string;
}
export const getUserTasksRef: GetUserTasksRef;

export function getUserTasks(vars: GetUserTasksVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserTasksData, GetUserTasksVariables>;
export function getUserTasks(dc: DataConnect, vars: GetUserTasksVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserTasksData, GetUserTasksVariables>;

interface CreateTaskRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTaskVariables): MutationRef<CreateTaskData, CreateTaskVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateTaskVariables): MutationRef<CreateTaskData, CreateTaskVariables>;
  operationName: string;
}
export const createTaskRef: CreateTaskRef;

export function createTask(vars: CreateTaskVariables): MutationPromise<CreateTaskData, CreateTaskVariables>;
export function createTask(dc: DataConnect, vars: CreateTaskVariables): MutationPromise<CreateTaskData, CreateTaskVariables>;

interface UpdateTaskStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTaskStatusVariables): MutationRef<UpdateTaskStatusData, UpdateTaskStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTaskStatusVariables): MutationRef<UpdateTaskStatusData, UpdateTaskStatusVariables>;
  operationName: string;
}
export const updateTaskStatusRef: UpdateTaskStatusRef;

export function updateTaskStatus(vars: UpdateTaskStatusVariables): MutationPromise<UpdateTaskStatusData, UpdateTaskStatusVariables>;
export function updateTaskStatus(dc: DataConnect, vars: UpdateTaskStatusVariables): MutationPromise<UpdateTaskStatusData, UpdateTaskStatusVariables>;

interface LogHabitCompletionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: LogHabitCompletionVariables): MutationRef<LogHabitCompletionData, LogHabitCompletionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: LogHabitCompletionVariables): MutationRef<LogHabitCompletionData, LogHabitCompletionVariables>;
  operationName: string;
}
export const logHabitCompletionRef: LogHabitCompletionRef;

export function logHabitCompletion(vars: LogHabitCompletionVariables): MutationPromise<LogHabitCompletionData, LogHabitCompletionVariables>;
export function logHabitCompletion(dc: DataConnect, vars: LogHabitCompletionVariables): MutationPromise<LogHabitCompletionData, LogHabitCompletionVariables>;

