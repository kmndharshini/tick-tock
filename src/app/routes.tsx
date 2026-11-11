import { Navigate, Route, Routes } from 'react-router-dom';
import { HomeScreen } from '../screens/HomeScreen';
import { LearnScreen } from '../screens/LearnScreen';
import { InteractiveClockScreen } from '../screens/InteractiveClockScreen';
import { ExerciseScreen } from '../screens/ExerciseScreen';
import { ChallengeScreen } from '../screens/ChallengeScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ParentTeacherScreen } from '../screens/ParentTeacherScreen';

/** Route definitions for all 7 main Tick-Tock screens. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/learn" element={<LearnScreen />} />
      <Route path="/explore" element={<InteractiveClockScreen />} />
      <Route path="/exercise" element={<ExerciseScreen />} />
      <Route path="/challenge" element={<ChallengeScreen />} />
      <Route path="/progress" element={<ProgressScreen />} />
      <Route path="/parent" element={<ParentTeacherScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

