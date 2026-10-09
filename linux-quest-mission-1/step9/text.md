# Mission 9: Layer cake

**Difficulty:** Hard · **400 points**

**Objective:** Peel back every layer of encoding to reveal the flag.

```
cd ~/mission9
cat cake.b64
```{{exec}}

You decoded base64 in the last mission. This message was encoded, then the result was encoded **again**, and again. Nobody wrote down how many layers there are.

Copying each result into the next command works, but it is slow. A pipe (`|`) can feed one `base64 -d` straight into the next. Keep adding layers until you see the flag.

**Useful command:** `base64`. Use `--help` to discover what they can do.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

Start with `base64 -d cake.b64`. Still gibberish? Add `| base64 -d` to the end and run it again. Repeat until it says **Flag**.

</details>
