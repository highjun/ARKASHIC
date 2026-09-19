import { useViewModel } from "#core/viewmodel";
import { observer } from "mobx-react-lite";
import { Banner } from "@primer/react";
import { ErrorBoundary } from "#utils/errorBoundary";
import { ShellView } from "./ShellView";

/**
 * 앱의 맨 바깥. 셸이 렌더 중 죽으면 오류를 `IErrorLog`에 남기고 빈 화면 대신 띠를 띄운다.
 *
 * **커널은 죽었다는 사실만 안다.** 무엇을 보여 줄지는 그것을 아는 쪽 — 확장 — 의 몫이라
 * 여기 전용 부품(`CrashScreen`)을 두지 않는다. 여기 있는 것은 그 어느 확장도 살아 있지 않을
 * 때의 마지막 자리라, 이미 그려진 공용 부품 하나로 족하다. 스택은 내지 않는다 — 사용자가 할
 * 수 있는 일은 다시 불러오기뿐이고 경로가 실리면 서버가 어디 뿌리내렸는지가 샌다.
 *
 * `ShellView`와 분리한 이유 — ErrorBoundary는 자기 자신의 오류를 못 잡는다. 셸 안에 두면 셸이
 * 죽을 때 같이 죽는다.
 */
export const RootView = observer(function RootView() {
  const errorLog = useViewModel("arka.workbench.errorLog");
  return (
    <ErrorBoundary
      onError={(error) => errorLog.report(error, "render")}
      renderFallback={(error) => (
        <Banner
          role="alert"
          variant="critical"
          title="화면을 그리다 오류가 났다"
          description={`${error.name}: ${error.message}`}
          primaryAction={<Banner.PrimaryAction onClick={() => location.reload()}>다시 불러오기</Banner.PrimaryAction>}
        />
      )}
    >
      <ShellView />
    </ErrorBoundary>
  );
});
