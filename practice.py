class Solution:
    def isPalindrome(self, n):
        original=n
        rev=0
        while n>0:
            digit = n%10
            rev= rev*10+digit
            n//=10
        return original == rev
n=121
a=Solution()
b=a.isPalindrome(n)
print(b)
