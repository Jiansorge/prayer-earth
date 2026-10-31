package app.joiningpalms.benchmark;

import androidx.benchmark.macro.junit4.BaselineProfileRule;

import kotlin.Unit;

import org.junit.Rule;
import org.junit.Test;

// Records the baseline profile: the classes and methods the app touches while
// it starts from cold (home screen -> first frame of the home view).
//
// Written in Java on purpose - the repo has no Kotlin plugin, and adding one to
// the whole build for a single test file would put the release build at risk
// for no benefit. The benchmark library is Kotlin but fully callable from Java.
//
// Run with a device attached; see docs/PERFORMANCE.md for the exact commands
// and what to do with the profile it emits.
public class BaselineProfile {
    @Rule
    public final BaselineProfileRule rule = new BaselineProfileRule();

    @Test
    public void startup() {
        rule.collect(
                "app.joiningpalms", // packageName
                15, // maxIterations - the rule stops early once stable
                3, // stableIterations
                null, // outputFilePrefix (defaults to <Class>_<method>)
                false, // includeInStartupProfile
                false, // strictStability
                name -> true, // filterPredicate - record everything reached
                scope -> {
                    scope.pressHome(0L);
                    scope.startActivityAndWait(intent -> Unit.INSTANCE);
                    return Unit.INSTANCE;
                });
    }
}
