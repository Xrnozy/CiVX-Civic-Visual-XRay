import { GetUserTasksData, GetUserTasksVariables, CreateTaskData, CreateTaskVariables, UpdateTaskStatusData, UpdateTaskStatusVariables, LogHabitCompletionData, LogHabitCompletionVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useGetUserTasks(vars: GetUserTasksVariables, options?: useDataConnectQueryOptions<GetUserTasksData>): UseDataConnectQueryResult<GetUserTasksData, GetUserTasksVariables>;
export function useGetUserTasks(dc: DataConnect, vars: GetUserTasksVariables, options?: useDataConnectQueryOptions<GetUserTasksData>): UseDataConnectQueryResult<GetUserTasksData, GetUserTasksVariables>;

export function useCreateTask(options?: useDataConnectMutationOptions<CreateTaskData, FirebaseError, CreateTaskVariables>): UseDataConnectMutationResult<CreateTaskData, CreateTaskVariables>;
export function useCreateTask(dc: DataConnect, options?: useDataConnectMutationOptions<CreateTaskData, FirebaseError, CreateTaskVariables>): UseDataConnectMutationResult<CreateTaskData, CreateTaskVariables>;

export function useUpdateTaskStatus(options?: useDataConnectMutationOptions<UpdateTaskStatusData, FirebaseError, UpdateTaskStatusVariables>): UseDataConnectMutationResult<UpdateTaskStatusData, UpdateTaskStatusVariables>;
export function useUpdateTaskStatus(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateTaskStatusData, FirebaseError, UpdateTaskStatusVariables>): UseDataConnectMutationResult<UpdateTaskStatusData, UpdateTaskStatusVariables>;

export function useLogHabitCompletion(options?: useDataConnectMutationOptions<LogHabitCompletionData, FirebaseError, LogHabitCompletionVariables>): UseDataConnectMutationResult<LogHabitCompletionData, LogHabitCompletionVariables>;
export function useLogHabitCompletion(dc: DataConnect, options?: useDataConnectMutationOptions<LogHabitCompletionData, FirebaseError, LogHabitCompletionVariables>): UseDataConnectMutationResult<LogHabitCompletionData, LogHabitCompletionVariables>;
