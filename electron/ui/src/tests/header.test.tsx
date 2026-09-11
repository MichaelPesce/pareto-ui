import { fireEvent, render, screen } from '@testing-library/react';
import Header from "../components/Header/Header";
import { MemoryRouter } from "react-router-dom";
import { ScenarioProvider } from 'context/ScenarioContext';
import { AppProvider } from 'AppContext';

const navigate = () => {};

test('test header when not on root path', () => {
  render(
    <AppProvider>
      <MemoryRouter initialEntries={['/test']}>
        <ScenarioProvider navigate={navigate}>
          <Header />
        </ScenarioProvider>
      </MemoryRouter>
    </AppProvider>
  );

  expect(
    screen.getByRole('img', { name: /Pareto logo/i })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Open app menu'}));
  expect(screen.getByRole('menuitem', {name: 'Settings'})).toBeInTheDocument();
  expect(screen.getByRole('menuitem', {name: 'View scenario list'})).toBeInTheDocument();
});
