# Mission 10: Endgame

**Difficulty:** Very Hard · **800 points**

**Objective:** Recover three hidden pieces and put the final flag together.

```
cd ~/mission10
cat README.txt
```{{exec}}

The final mission uses **everything** you have learned. The flag was split into three pieces, and each one is hidden a different way. `README.txt` tells you where each piece is.

Put the pieces together in order, joined with dashes: `CYBA{piece1-piece2-piece3}`.

There are no new commands here. `find`, `grep`, `cut`, `base64`, `chmod` and pipes are all you need.

**Useful commands:** `find`, `grep`, `cut`, `base64`, `chmod`. Use `--help` to discover what they can do.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

Take one piece at a time. **Piece 1:** hidden file names start with a dot, so search `vault` for names that match `.*`. **Piece 2:** `grep` the intruder's name, then decode their token (`cut` can pull the token out of the line). **Piece 3:** you have opened a locked script before.

</details>
