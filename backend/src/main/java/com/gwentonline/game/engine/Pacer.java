package com.gwentonline.game.engine;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

/**
 * Turns the original asynchronous animation timeline into pauses of the engine thread.
 * {@link #parallel} emulates {@code Promise.all}: branches run one after another but their pauses
 * are merged, so the total wait equals the longest branch instead of their sum.
 */
final class Pacer {

    private final GameListener listener;
    private final double factor;
    private final Deque<long[]> branches = new ArrayDeque<>();

    Pacer(GameListener listener, double factor) {
        this.listener = listener;
        this.factor = factor;
    }

    void pause(Pacing pacing) {
        pause(pacing.millis());
    }

    void pause(long millis) {
        if (!branches.isEmpty()) {
            branches.peek()[0] += millis;
        } else if (factor > 0 && millis > 0) {
            listener.pause(Math.round(millis * factor));
        } else {
            listener.pause(0);
        }
    }

    void parallel(List<Runnable> tasks) {
        long longest = 0;
        for (Runnable task : tasks) {
            branches.push(new long[1]);
            try {
                task.run();
            } finally {
                longest = Math.max(longest, branches.pop()[0]);
            }
        }
        pause(longest);
    }
}
