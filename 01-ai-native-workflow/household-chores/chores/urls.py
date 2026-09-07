from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("chores/new/", views.create_chore, name="create_chore"),
    path("chores/<int:chore_id>/complete/", views.complete_chore, name="complete_chore"),
]
