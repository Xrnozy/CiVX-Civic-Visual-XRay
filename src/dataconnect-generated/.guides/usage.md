# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { getUserTasks, createTask, updateTaskStatus, logHabitCompletion } from '@dataconnect/generated';


// Operation GetUserTasks:  For variables, look at type GetUserTasksVars in ../index.d.ts
const { data } = await GetUserTasks(dataConnect, getUserTasksVars);

// Operation CreateTask:  For variables, look at type CreateTaskVars in ../index.d.ts
const { data } = await CreateTask(dataConnect, createTaskVars);

// Operation UpdateTaskStatus:  For variables, look at type UpdateTaskStatusVars in ../index.d.ts
const { data } = await UpdateTaskStatus(dataConnect, updateTaskStatusVars);

// Operation LogHabitCompletion:  For variables, look at type LogHabitCompletionVars in ../index.d.ts
const { data } = await LogHabitCompletion(dataConnect, logHabitCompletionVars);


```